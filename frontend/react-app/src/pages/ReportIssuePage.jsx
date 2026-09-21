import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import DashboardNavbar from "../components/layout/DashboardNavbar";
import MobileBottomNav from "../components/layout/MobileBottomNav";
import { complaintService } from "../services/complaintService";
import { useAuth } from "../context/AuthContext";

// Custom high-visibility civic location pin
const customPinIcon = L.divIcon({
  className: "custom-civic-pin",
  html: `
    <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: rgba(0, 88, 190, 0.35); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="position: relative; width: 34px; height: 34px; background: #0058be; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2.5px solid #ffffff; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center;">
        <div style="width: 12px; height: 12px; background: #ffffff; border-radius: 50%; transform: rotate(45deg);"></div>
      </div>
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 38],
  popupAnchor: [0, -38],
});

// Component to dynamically re-center map whenever GPS coordinates change
function MapUpdater({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position && position[0] && position[1]) {
      map.setView(position, 16, { animate: true });
    }
  }, [position, map]);
  return null;
}

const reverseGeocode = async (lat, lng, setAddress, setLandmarkDetails) => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
    );
    const data = await res.json();
    if (data && data.display_name) {
      setLandmarkDetails(data.display_name);
      setAddress((prev) => (prev ? prev : data.display_name));
    }
  } catch (err) {
    console.error("Geocoding error:", err);
  }
};

const ReportIssuePage = () => {
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();

  // Wizard state (1: Category, 2: Evidence, 3: Location, 4: Details, 5: Review, 6: Success)
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState(
    searchParams.get("category") || "",
  );
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [isAnonymous, setIsAnonymous] = useState(
    searchParams.get("anonymous") === "true",
  );
  const [reporterName, setReporterName] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");
  const [aiStatus, setAiStatus] = useState({
    loading: false,
    detected: false,
    category: "",
    confidence: 0,
    message: "",
  });
  const [duplicateInfo, setDuplicateInfo] = useState(null);
  const [nearbyComplaints, setNearbyComplaints] = useState([]);
  const [upvotingComplaintId, setUpvotingComplaintId] = useState(null);
  const [expandedComplaintId, setExpandedComplaintId] = useState(null);
  const [upvotedComplaintIds, setUpvotedComplaintIds] = useState([]);
  const [upvoteSuccessMessage, setUpvoteSuccessMessage] = useState("");
  const [upvoteTargetComplaint, setUpvoteTargetComplaint] = useState(null);
  const [proceedAsNewIssue, setProceedAsNewIssue] = useState(false);
  const [upvoteSuccessData, setUpvoteSuccessData] = useState(null);

  // Camera stream state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // Location state (Non-editable map, auto-detected GPS)
  const [position, setPosition] = useState([28.6139, 77.209]); // Default: Delhi
  const [landmarkDetails, setLandmarkDetails] = useState("");
  const [address, setAddress] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [gpsDetected, setGpsDetected] = useState(false);

  // Details state
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedComplaint, setSubmittedComplaint] = useState(null);
  const [error, setError] = useState("");

  const startCamera = async () => {
    setCameraError("");
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          "Camera API is not supported on this browser. Use mobile camera capture below.",
        );
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Rear camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      console.warn(
        "Live webcam stream not accessible, fallback to native camera:",
        err,
      );
      setCameraActive(false);
      setCameraError(
        'Please allow camera permissions or tap "Open Device Camera" below.',
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const captureLivePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `live_photo_${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        const previewUrl = URL.createObjectURL(blob);

        setSelectedFiles((prev) => [...prev, file].slice(0, 5));
        setFilePreviews((prev) => [...prev, previewUrl].slice(0, 5));
      },
      "image/jpeg",
      0.9,
    );
  };

  const handleNativeCameraCapture = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newFiles = [...selectedFiles, ...files].slice(0, 5);
    setSelectedFiles(newFiles);

    const previews = newFiles.map((file) => URL.createObjectURL(file));
    setFilePreviews(previews);
    if (e.target) e.target.value = "";
  };

  const handleGalleryUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newFiles = [...selectedFiles, ...files].slice(0, 5);
    setSelectedFiles(newFiles);

    const previews = newFiles.map((file) => URL.createObjectURL(file));
    setFilePreviews(previews);
    if (e.target) e.target.value = "";
  };

  const handleRemoveFile = (index) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const newPreviews = filePreviews.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    setFilePreviews(newPreviews);
  };

  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      reverseGeocode(position[0], position[1], setAddress, setLandmarkDetails);
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPosition([latitude, longitude]);
        reverseGeocode(latitude, longitude, setAddress, setLandmarkDetails);
        setIsLocating(false);
        setGpsDetected(true);
      },
      (err) => {
        console.error("GPS error:", err);
        setIsLocating(false);
        reverseGeocode(
          position[0],
          position[1],
          setAddress,
          setLandmarkDetails,
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  useEffect(() => {
    const categoryParam = searchParams.get("category");
    if (categoryParam) {
      setSelectedCategory(categoryParam);
    }
  }, [searchParams]);

  // Handle camera stream initialization & cleanup
  useEffect(() => {
    if (currentStep === 1) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [currentStep]);

  // Auto-detect GPS when entering Step 3
  useEffect(() => {
    if (currentStep === 3) {
      if (!gpsDetected) {
        handleDetectGPS();
      } else if (!landmarkDetails) {
        reverseGeocode(
          position[0],
          position[1],
          setAddress,
          setLandmarkDetails,
        );
      }
    }
  }, [currentStep, gpsDetected, landmarkDetails, position]);

  const categories = [
    {
      key: "pothole",
      title: "Pothole",
      description:
        "Report deep holes, sunken covers, or severe road degradation.",
      icon: "landscape",
    },
    {
      key: "broken_streetlight",
      title: "Broken Streetlight",
      description:
        "Flickering, completely out, or damaged street illumination.",
      icon: "lightbulb",
    },
    {
      key: "garbage",
      title: "Garbage / Waste",
      description:
        "Illegal dumping, missed collections, or overflowing public bins.",
      icon: "delete",
    },
    {
      key: "drainage",
      title: "Drainage & Sewage",
      description: "Blocked drains, localized flooding, or sewage leaks.",
      icon: "water_drop",
    },
    {
      key: "water_issue",
      title: "Water Supply",
      description:
        "Burst pipes, low pressure, or suspected water contamination.",
      icon: "plumbing",
    },
    {
      key: "public_property",
      title: "Public Infrastructure",
      description: "Damaged bus stops, broken benches, or playground hazards.",
      icon: "construction",
    },
    {
      key: "road_damage",
      title: "Road Damage",
      description: "Faded markings, damaged signs, or sidewalk issues.",
      icon: "add_road",
    },
    {
      key: "other",
      title: "Other Civic Issue",
      description:
        "Anything else that requires municipal attention and action.",
      icon: "category",
    },
  ];

  const handleSubmitReport = async () => {
    if (
      !selectedCategory ||
      !description ||
      !address ||
      selectedFiles.length === 0
    ) {
      setError(
        "Please complete all required fields including photo evidence and your full address.",
      );
      return;
    }

    if (!isAuthenticated && !isAnonymous) {
      setError(
        "Please sign in or choose to report anonymously before submitting.",
      );
      return;
    }

    if (isAnonymous && (!reporterPhone || reporterPhone.trim().length < 8)) {
      setError("Please add a valid phone number for anonymous reporting.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("category", selectedCategory);
      formData.append("description", description);
      formData.append("latitude", String(position[0]));
      formData.append("longitude", String(position[1]));
      formData.append("address", address);
      formData.append(
        "reporterName",
        isAnonymous ? reporterName || "Anonymous" : "",
      );
      formData.append("reporterPhone", isAnonymous ? reporterPhone : "");
      formData.append("isAnonymous", String(isAnonymous));
      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const response = await complaintService.createComplaint(formData);
      if (response && response.complaint) {
        setSubmittedComplaint(response.complaint);
        setCurrentStep(6); // Success Step
      }
    } catch (err) {
      console.error("Submission error:", err);
      setError(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          "Failed to submit complaint. Please check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const getStepProgressPercentage = () => {
    switch (currentStep) {
      case 1:
        return "0%";
      case 2:
        return "25%";
      case 3:
        return "50%";
      case 4:
        return "75%";
      case 5:
      case 6:
        return "100%";
      default:
        return "0%";
    }
  };

  const selectedCategoryObj = categories.find(
    (c) => c.key === selectedCategory,
  );

  useEffect(() => {
    if (!isAnonymous) {
      setReporterName("");
      setReporterPhone("");
    }
  }, [isAnonymous]);

  useEffect(() => {
    if (selectedFiles.length === 0) {
      setAiStatus({
        loading: false,
        detected: false,
        category: "",
        confidence: 0,
        message: "",
      });
      return;
    }

    const primaryFile = selectedFiles[0];
    setAiStatus((prev) => ({
      ...prev,
      loading: true,
      message: "Analyzing image...",
    }));

    complaintService
      .verifyIssueImage(primaryFile)
      .then((result) => {
        if (result && result.success) {
          const mapped = result.mappedCategory || result.category || "";
          const confidence = Number(result.confidence || 0);
          const detected = Boolean(
            result.verified && mapped && mapped !== "other" && confidence > 0,
          );
          setAiStatus({
            loading: false,
            detected,
            category: mapped,
            confidence,
            message: result.message || "AI analysis complete.",
          });

          if (detected && (selectedCategory === "" || !selectedCategory)) {
            setSelectedCategory(mapped);
          }
        }
      })
      .catch(() => {
        setAiStatus({
          loading: false,
          detected: false,
          category: "",
          confidence: 0,
          message:
            "Image analysis could not confidently classify this issue. You can choose a category manually.",
        });
      });
  }, [selectedFiles]);

  const handleAdvanceToDetails = async () => {
    if (!address || address.trim().length < 5) {
      setError("Please enter a complete address before continuing.");
      return;
    }

    try {
      const duplicateResponse = await complaintService.checkDuplicate({
        category: selectedCategory,
        latitude: position[0],
        longitude: position[1],
        radiusMeters: 50,
      });

      const categoryComplaints = (
        duplicateResponse?.nearbyComplaints || []
      ).filter((complaint) => complaint.category === selectedCategory);
      setNearbyComplaints(categoryComplaints);

      if (categoryComplaints.length > 0) {
        // Show existing complaints as choices before creating a new complaint
        setDuplicateInfo(categoryComplaints[0]);
        setProceedAsNewIssue(false);
        setUpvoteTargetComplaint(null);
        setError("");
      } else {
        setDuplicateInfo(null);
        setNearbyComplaints([]);
        setProceedAsNewIssue(true);
        setUpvoteTargetComplaint(null);
        setError("");
      }

      // Always proceed to the Details step
      setCurrentStep(4);
    } catch (err) {
      console.error("Duplicate check failed:", err);
      setError(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          "Unable to verify whether a similar complaint already exists.",
      );
    }
  };

  const handleSelectComplaintForUpvote = (complaint) => {
    setUpvoteTargetComplaint(complaint);
    setProceedAsNewIssue(false);
    setError("");
  };

  const handleConfirmUpvote = async () => {
    const target = upvoteTargetComplaint;
    if (!target) return;

    if (
      !isAuthenticated &&
      (!reporterPhone || reporterPhone.trim().length < 8)
    ) {
      setError("Please enter a valid phone number (at least 8 digits) to record your upvote.");
      return;
    }

    setUpvotingComplaintId(target.complaintId);
    setError("");
    try {
      const response = await complaintService.upvoteComplaint(
        target.complaintId,
        isAuthenticated ? "" : reporterPhone,
      );

      const finalUpvotes = response?.upvotes ?? (target.upvotes || 0) + 1;

      setUpvotedComplaintIds((prev) =>
        prev.includes(target.complaintId) ? prev : [...prev, target.complaintId]
      );

      setUpvoteSuccessData({
        complaintId: target.complaintId,
        category: target.category || selectedCategory,
        status: target.status || "SUBMITTED",
        description: target.description || "Reported nearby hazard.",
        address: target.address || address,
        department: target.department || "Municipal Department",
        upvotes: finalUpvotes,
        voterPhone: reporterPhone || user?.phone || "Anonymous",
        voterName: reporterName || (isAnonymous ? "Anonymous" : user?.name || "Citizen"),
      });

      // Directly move to Step 6 — user cannot create a new issue
      setCurrentStep(6);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Unable to submit upvote for this complaint.",
      );
    } finally {
      setUpvotingComplaintId(null);
    }
  };

  const handleUpvoteComplaint = async (complaintId) => {
    const matched = nearbyComplaints.find((c) => c.complaintId === complaintId);
    if (matched) {
      handleSelectComplaintForUpvote(matched);
      return;
    }

    if (
      !isAuthenticated &&
      (!reporterPhone || reporterPhone.trim().length < 8)
    ) {
      setError("Please enter a valid phone number (under Contact Phone) to upvote anonymously.");
      return;
    }

    setUpvotingComplaintId(complaintId);
    setError("");
    try {
      const response = await complaintService.upvoteComplaint(
        complaintId,
        isAuthenticated ? "" : reporterPhone,
      );
      setNearbyComplaints((complaints) =>
        complaints.map((complaint) =>
          complaint.complaintId === complaintId
            ? { ...complaint, upvotes: response.upvotes }
            : complaint,
        ),
      );
      setUpvotedComplaintIds((prev) =>
        prev.includes(complaintId) ? prev : [...prev, complaintId]
      );
      if (response.alreadyUpvoted) {
        setUpvoteSuccessMessage(`You have already upvoted report #${complaintId}.`);
      } else {
        setUpvoteSuccessMessage(
          `Successfully upvoted report #${complaintId}! Thanks for validating this civic hazard.`
        );
      }
    } catch (err) {
      setError(
        err.response?.data?.detail || "Unable to upvote this complaint.",
      );
    } finally {
      setUpvotingComplaintId(null);
    }
  };

  return (
    <div className="bg-background text-on-background min-h-screen font-body-md selection:bg-primary-container selection:text-on-primary-container pb-24 md:pb-12">
      <DashboardNavbar />

      <main className="pt-20 pb-section-gap px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        {/* Header & Stepper Section */}
        <div className="mb-12">
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-2 font-bold">
            Report an Issue
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mb-8">
            {currentStep === 1 &&
              "Capture live photo evidence so AI can identify the issue category."}
            {currentStep === 2 &&
              "Review the AI category suggestion or choose a category manually."}
            {currentStep === 3 &&
              "Location auto-detected via GPS. Enter your full address."}
            {currentStep === 4 &&
              "Describe the hazard and severity for the field team."}
            {currentStep === 5 &&
              "Review all details before transmitting to the department."}
            {currentStep === 6 &&
              "Complaint successfully dispatched to city administration."}
          </p>

          {/* Progress Tracker */}
          {currentStep <= 5 && (
            <div className="flex items-center justify-between w-full relative">
              {/* Connecting Line Base */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-surface-container-high z-0"></div>
              {/* Active Line */}
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] bg-primary z-0 transition-all duration-500"
                style={{ width: getStepProgressPercentage() }}
              ></div>

              {/* Step 1: Evidence */}
              <div
                className="relative z-10 flex flex-col items-center gap-2 cursor-pointer"
                onClick={() => setCurrentStep(1)}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-label-md text-label-md ring-4 ring-background transition-all ${
                    currentStep >= 1
                      ? "bg-primary text-on-primary font-bold"
                      : "bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  1
                </div>
                <span
                  className={`font-label-md text-label-md hidden md:block ${
                    currentStep >= 1
                      ? "text-primary font-bold"
                      : "text-on-surface-variant"
                  }`}
                >
                  Evidence
                </span>
              </div>

              {/* Step 2: Category */}
              <div
                className={`relative z-10 flex flex-col items-center gap-2 ${
                  selectedFiles.length > 0 ? "cursor-pointer" : ""
                }`}
                onClick={() => selectedFiles.length > 0 && setCurrentStep(2)}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-label-md text-label-md ring-4 ring-background transition-all ${
                    currentStep >= 2
                      ? "bg-primary text-on-primary font-bold"
                      : "bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  2
                </div>
                <span
                  className={`font-label-md text-label-md hidden md:block ${
                    currentStep >= 2
                      ? "text-primary font-bold"
                      : "text-on-surface-variant"
                  }`}
                >
                  Category
                </span>
              </div>

              {/* Step 3: Location */}
              <div
                className={`relative z-10 flex flex-col items-center gap-2 ${
                  selectedCategory ? "cursor-pointer" : ""
                }`}
                onClick={() => selectedCategory && setCurrentStep(3)}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-label-md text-label-md ring-4 ring-background transition-all ${
                    currentStep >= 3
                      ? "bg-primary text-on-primary font-bold"
                      : "bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  3
                </div>
                <span
                  className={`font-label-md text-label-md hidden md:block ${
                    currentStep >= 3
                      ? "text-primary font-bold"
                      : "text-on-surface-variant"
                  }`}
                >
                  Location
                </span>
              </div>

              {/* Step 4: Details */}
              <div
                className={`relative z-10 flex flex-col items-center gap-2 ${
                  selectedCategory ? "cursor-pointer" : ""
                }`}
                onClick={() => selectedCategory && setCurrentStep(4)}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-label-md text-label-md ring-4 ring-background transition-all ${
                    currentStep >= 4
                      ? "bg-primary text-on-primary font-bold"
                      : "bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  4
                </div>
                <span
                  className={`font-label-md text-label-md hidden md:block ${
                    currentStep >= 4
                      ? "text-primary font-bold"
                      : "text-on-surface-variant"
                  }`}
                >
                  Details
                </span>
              </div>

              {/* Step 5: Review */}
              <div
                className={`relative z-10 flex flex-col items-center gap-2 ${
                  selectedCategory && description ? "cursor-pointer" : ""
                }`}
                onClick={() =>
                  selectedCategory && description && setCurrentStep(5)
                }
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-label-md text-label-md ring-4 ring-background transition-all ${
                    currentStep >= 5
                      ? "bg-primary text-on-primary font-bold"
                      : "bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  5
                </div>
                <span
                  className={`font-label-md text-label-md hidden md:block ${
                    currentStep >= 5
                      ? "text-primary font-bold"
                      : "text-on-surface-variant"
                  }`}
                >
                  Review
                </span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-error-container/30 border border-error/30 text-error flex items-start gap-3">
            <span className="material-symbols-outlined text-xl shrink-0 mt-0.5">
              error
            </span>
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {upvoteSuccessMessage && (
          <div className="mb-6 p-4 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-xl shrink-0 text-emerald-600">
                check_circle
              </span>
              <p className="text-sm font-medium">{upvoteSuccessMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setUpvoteSuccessMessage("")}
              className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 p-1"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        )}

        {/* STEP 2: AI CATEGORY REVIEW AND MANUAL FALLBACK */}
        {currentStep === 2 && (
          <div>
            <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <span className="material-symbols-outlined">smart_toy</span>
                AI category suggestion
              </div>
              <p className="mt-2 text-sm text-on-surface-variant">
                {aiStatus.loading
                  ? "AI is analyzing your uploaded image..."
                  : aiStatus.detected
                    ? `AI detected ${selectedCategoryObj?.title || aiStatus.category} with ${aiStatus.confidence} confidence.`
                    : "AI could not confidently classify this image. Please select the closest category manually."}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat.key);
                    }}
                    className={`flex flex-col items-start p-6 rounded-xl border civic-glow civic-glow-hover transition-all duration-200 text-left group focus:outline-none ${
                      isSelected
                        ? "ring-2 ring-primary bg-surface-container-low border-primary"
                        : "bg-surface-container-lowest border-surface-container-highest"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <span
                        className="material-symbols-outlined text-primary"
                        data-icon={cat.icon}
                      >
                        {cat.icon}
                      </span>
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2 font-bold">
                      {cat.title}
                    </h3>
                    <p className="font-body-md text-body-md text-on-surface-variant">
                      {cat.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Next Step Action */}
            <div className="mt-12 flex justify-end">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                disabled={!selectedCategory}
                className={`bg-primary text-on-primary px-8 py-3 rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors shadow-sm flex items-center gap-2 ${
                  !selectedCategory
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:shadow-level-2"
                }`}
              >
                Continue to Location
                <span
                  className="material-symbols-outlined"
                  data-icon="arrow_forward"
                >
                  arrow_forward
                </span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 1: LIVE PHOTO CAPTURE ONLY */}
        {currentStep === 1 && (
          <div className="bg-surface-container-lowest rounded-xl p-6 md:p-8 border border-outline-variant/30 civic-glow">
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-2 font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">
                photo_camera
              </span>
              Take Live Photo Evidence
            </h2>
            <p className="font-body-md text-on-surface-variant mb-6">
              Use your device camera to snap live on-site evidence or upload photos from your gallery (Max 5 photos).
            </p>

            {/* Live Camera Viewfinder Card */}
            <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/30 flex flex-col items-center justify-center mb-6">
              {/* Video Feed */}
              <div className="relative w-full max-w-lg aspect-video bg-black rounded-xl overflow-hidden shadow-md flex items-center justify-center mb-4">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${cameraActive ? "block" : "hidden"}`}
                />

                {!cameraActive && (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-white/80">
                    <span className="material-symbols-outlined text-5xl mb-2 text-primary">
                      videocam
                    </span>
                    <p className="text-sm font-semibold mb-3">
                      Live Camera Viewfinder
                    </p>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-lg hover:bg-primary-container shadow-sm"
                    >
                      Turn On Camera
                    </button>
                  </div>
                )}

                {cameraActive && (
                  <div className="absolute top-3 left-3 bg-red-600/90 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                    LIVE CAMERA
                  </div>
                )}
              </div>

              {cameraError && (
                <p className="text-xs text-error mb-3">{cameraError}</p>
              )}

              {/* Shutter & Upload Controls */}
              <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
                {cameraActive && (
                  <button
                    type="button"
                    onClick={captureLivePhoto}
                    disabled={selectedFiles.length >= 5}
                    className="px-6 py-3.5 bg-primary text-on-primary font-bold font-label-md rounded-xl hover:bg-primary-container shadow-level-1 flex items-center gap-2 disabled:opacity-50 transition-all transform active:scale-95"
                  >
                    <span className="material-symbols-outlined text-xl">
                      photo_camera
                    </span>
                    Capture Photo ({selectedFiles.length}/5)
                  </button>
                )}

                {/* Mobile Camera Direct Shutter Trigger */}
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={selectedFiles.length >= 5}
                  className="px-6 py-3.5 bg-surface-container-highest text-on-primary-fixed-variant font-semibold font-label-md rounded-xl hover:bg-primary-fixed-dim shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-xl">
                    camera_alt
                  </span>
                  Open Device Camera
                </button>

                {/* Upload from Gallery Button */}
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={selectedFiles.length >= 5}
                  className="px-6 py-3.5 bg-primary/10 text-primary border border-primary/30 font-semibold font-label-md rounded-xl hover:bg-primary/20 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-xl">
                    photo_library
                  </span>
                  Upload from Gallery
                </button>

                {/* Hidden direct camera input for mobile browser native camera app */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleNativeCameraCapture}
                  className="hidden"
                />

                {/* Hidden gallery file input */}
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleGalleryUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Captured Photos Gallery */}
            {filePreviews.length > 0 ? (
              <div className="mb-8">
                <h4 className="font-label-md text-on-surface mb-3 font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-base">
                    check_circle
                  </span>
                  Captured Evidence Photos ({filePreviews.length}/5)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  {filePreviews.map((preview, idx) => (
                    <div
                      key={idx}
                      className="relative rounded-lg overflow-hidden border border-outline-variant/30 h-28 group shadow-sm"
                    >
                      <img
                        src={preview}
                        alt={`Captured ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        className="absolute top-1 right-1 w-7 h-7 rounded-full bg-error text-white flex items-center justify-center shadow-md hover:bg-red-700 transition-colors"
                        aria-label="Remove captured photo"
                      >
                        <span className="material-symbols-outlined text-sm">
                          close
                        </span>
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-on-surface">
                    <span className="material-symbols-outlined text-primary">
                      smart_toy
                    </span>
                    {aiStatus.loading
                      ? "AI analyzing the uploaded evidence..."
                      : "AI verification status"}
                  </div>
                  <p className="mt-2 text-sm text-on-surface-variant">
                    {aiStatus.message || "No AI result yet."}
                  </p>
                  {aiStatus.detected && (
                    <div className="mt-2 text-xs text-primary font-semibold">
                      Detected category: {aiStatus.category} — confidence{" "}
                      {aiStatus.confidence}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mb-6 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-amber-700 dark:text-amber-300">
                <span className="material-symbols-outlined text-xl text-amber-600 dark:text-amber-400">
                  warning
                </span>
                <p className="text-xs font-medium">
                  At least 1 photo is required. Please capture a live photo or
                  select a file from your device to continue.
                </p>
              </div>
            )}

            <div className="flex justify-between items-center mt-8 pt-6 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-6 py-2.5 border border-outline-variant text-on-surface-variant font-label-md rounded-lg hover:bg-surface-container-low"
              >
                Start over
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                disabled={selectedFiles.length === 0}
                className="bg-primary text-on-primary px-8 py-3 rounded-lg font-label-md text-label-md hover:bg-primary-container shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue to Category
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: AUTO GPS DETECTED LOCATION & FULL ADDRESS INPUT */}
        {currentStep === 3 && (
          <div className="bg-surface-container-lowest rounded-xl p-6 md:p-8 border border-outline-variant/30 civic-glow">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface mb-1 font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">
                    location_on
                  </span>
                  Auto-Detected Location & Address
                </h2>
                <p className="text-sm text-on-surface-variant">
                  Your coordinates are automatically tagged via GPS. Please
                  enter your complete street address below.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDetectGPS}
                disabled={isLocating}
                className="px-5 py-2.5 bg-primary-fixed text-on-primary-fixed-variant rounded-lg font-label-md flex items-center gap-2 hover:bg-primary-fixed-dim transition-colors shadow-sm disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">
                  {isLocating ? "sync" : "my_location"}
                </span>
                {isLocating ? "Detecting GPS..." : "Re-Detect GPS Location"}
              </button>
            </div>

            {/* Read-only Pinned Leaflet Map (Non-interactive) */}
            <div className="w-full h-72 rounded-2xl overflow-hidden border border-outline-variant/30 shadow-inner mb-6 relative">
              <MapContainer
                center={position}
                zoom={16}
                dragging={false}
                touchZoom={false}
                doubleClickZoom={false}
                scrollWheelZoom={false}
                boxZoom={false}
                keyboard={false}
                zoomControl={false}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapUpdater position={position} />
                <Marker position={position} icon={customPinIcon}>
                  <Popup>Fixed GPS Location</Popup>
                </Marker>
              </MapContainer>

              {/* Read-Only Map Watermark Badge */}
              <div className="absolute bottom-3 right-3 bg-surface/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-primary border border-outline-variant/30 shadow-sm flex items-center gap-1 pointer-events-none">
                <span className="material-symbols-outlined text-sm">lock</span>
                GPS Position Locked: {position[0].toFixed(5)},{" "}
                {position[1].toFixed(5)}
              </div>
            </div>

            {/* Two Column Address Input Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Column 1: Landmark Details (Map Auto-Detected, Read-Only) */}
              <div>
                <label className="font-label-md text-label-md text-on-surface uppercase font-bold flex items-center gap-1.5 mb-2">
                  <span className="material-symbols-outlined text-sm text-primary">
                    pin_drop
                  </span>
                  Landmark Details{" "}
                  <span className="text-xs text-outline font-normal">
                    (Auto-Detected)
                  </span>
                </label>
                <div className="relative">
                  <textarea
                    rows={3}
                    value={landmarkDetails}
                    readOnly
                    placeholder="Auto-detecting address from map..."
                    className="w-full p-4 rounded-xl border border-outline-variant/60 bg-surface-container-low/80 text-on-surface-variant outline-none font-body-md resize-none shadow-sm cursor-not-allowed select-none"
                  />
                  <div className="absolute top-3 right-3 text-xs bg-surface-container-high px-2.5 py-1 rounded-md text-outline font-medium flex items-center gap-1 border border-outline-variant/30">
                    <span className="material-symbols-outlined text-xs">
                      lock
                    </span>
                    Read-only
                  </div>
                </div>
                <p className="text-xs text-outline mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">
                    info
                  </span>
                  This address is detected by the map and cannot be changed.
                </p>
              </div>

              {/* Column 2: Enter Full Address (User Editable) */}
              <div>
                <label className="font-label-md text-label-md text-on-surface uppercase font-bold flex items-center gap-1.5 mb-2">
                  <span className="material-symbols-outlined text-sm text-primary">
                    edit_location
                  </span>
                  Enter Full Address <span className="text-error">*</span>
                </label>
                <textarea
                  rows={3}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. House No. 42, 2nd Floor, Near Gate 2, Main Market Road..."
                  className="w-full p-4 rounded-xl border border-outline-variant bg-transparent text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-body-md resize-none shadow-sm"
                  required
                />
                <p className="text-xs text-outline mt-1">
                  Please enter specific address details (house/flat no, building
                  name, street, nearby instructions).
                </p>
              </div>
            </div>

            {nearbyComplaints.length > 0 && (
              <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
                <div className="flex items-start gap-3 mb-3">
                  <span className="material-symbols-outlined text-amber-600">
                    warning
                  </span>
                  <div>
                    <h3 className="font-label-md font-bold text-on-surface">
                      Similar {selectedCategoryObj?.title || selectedCategory}{" "}
                      issue{nearbyComplaints.length > 1 ? "s" : ""} already reported within 50m
                    </h3>
                    <p className="text-sm text-on-surface-variant mt-1">
                      You can <strong>upvote</strong> an existing report to add your support, or continue below to file a new complaint if your issue is distinct.
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  {nearbyComplaints.map((complaint) => {
                    const isUpvoted = upvotedComplaintIds.includes(complaint.complaintId);
                    const isUpvoting = upvotingComplaintId === complaint.complaintId;
                    const isExpanded = expandedComplaintId === complaint.complaintId;

                    return (
                      <div
                        key={complaint.complaintId}
                        className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4 transition-colors hover:border-primary/40 shadow-sm"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() =>
                              setExpandedComplaintId((currentId) =>
                                currentId === complaint.complaintId
                                  ? null
                                  : complaint.complaintId,
                              )
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setExpandedComplaintId((currentId) =>
                                  currentId === complaint.complaintId
                                    ? null
                                    : complaint.complaintId,
                                );
                              }
                            }}
                            className="cursor-pointer flex-1"
                          >
                            <p className="font-semibold text-on-surface flex items-center gap-2">
                              <span>#{complaint.complaintId}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-primary-fixed/40 text-primary uppercase">
                                {complaint.status}
                              </span>
                            </p>
                            <p className="text-sm text-on-surface-variant mt-1">
                              {complaint.address || "Reported nearby"} ·{" "}
                              {complaint.distanceMeters}m away
                            </p>
                            <p className="text-xs text-primary mt-2 font-semibold flex items-center gap-1">
                              <span>{isExpanded ? "Hide details" : "Click to view full details"}</span>
                              <span className="material-symbols-outlined text-xs">
                                {isExpanded ? "expand_less" : "expand_more"}
                              </span>
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleSelectComplaintForUpvote(complaint);
                              setCurrentStep(4);
                            }}
                            disabled={isUpvoting || isUpvoted}
                            className={`shrink-0 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all shadow-sm ${
                              isUpvoted
                                ? "bg-emerald-600 text-white border border-emerald-600 cursor-default"
                                : "border border-primary/40 text-primary hover:bg-primary/10 active:scale-95"
                            } disabled:opacity-80`}
                          >
                            <span className="material-symbols-outlined text-base">
                              {isUpvoted ? "check_circle" : "thumb_up"}
                            </span>
                            {isUpvoting
                              ? "Upvoting..."
                              : isUpvoted
                              ? `Upvoted (${complaint.upvotes || 0})`
                              : `Upvote (${complaint.upvotes || 0})`}
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-outline-variant/20 space-y-3 text-sm text-on-surface-variant">
                            <p>
                              <span className="font-semibold text-on-surface">
                                Category:
                              </span>{" "}
                              {complaint.category || selectedCategory}
                            </p>
                            <p>
                              <span className="font-semibold text-on-surface">
                                Description:
                              </span>{" "}
                              {complaint.description ||
                                "No description provided."}
                            </p>
                            <p>
                              <span className="font-semibold text-on-surface">
                                Location:
                              </span>{" "}
                              {complaint.address || "Not provided"}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mt-8 pt-6 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-6 py-2.5 border border-outline-variant text-on-surface-variant font-label-md rounded-lg hover:bg-surface-container-low"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleAdvanceToDetails}
                disabled={!address || address.trim().length < 5}
                className="bg-primary text-on-primary px-8 py-3 rounded-lg font-label-md text-label-md hover:bg-primary-container shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                Continue to Details
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: ISSUE DETAILS */}
        {currentStep === 4 && (
          <div>
            {/* BRANCH 1: User chose to UPVOTE an existing complaint (Details Only, CANNOT create new issue) */}
            {upvoteTargetComplaint ? (
              <div className="bg-surface-container-lowest rounded-xl p-6 md:p-8 border border-outline-variant/30 civic-glow">
                <div className="flex items-center gap-2 mb-2 text-primary">
                  <span className="material-symbols-outlined text-2xl">thumb_up</span>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    Support Existing Complaint #{upvoteTargetComplaint.complaintId}
                  </h2>
                </div>
                <p className="font-body-md text-on-surface-variant mb-6">
                  You are adding your support to an already reported hazard. <strong>Please enter your contact details only</strong> to record your official upvote. You will not create a new complaint.
                </p>

                {/* Existing Complaint Summary Card */}
                <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="font-bold text-primary text-base font-mono">
                      #{upvoteTargetComplaint.complaintId}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-primary text-on-primary uppercase">
                        {upvoteTargetComplaint.status}
                      </span>
                      <span className="text-xs text-outline font-medium">
                        • {upvoteTargetComplaint.distanceMeters}m away
                      </span>
                    </div>
                  </div>
                  <p className="font-semibold text-on-surface text-sm mb-1">
                    Category: {upvoteTargetComplaint.category || selectedCategory}
                  </p>
                  <p className="text-xs text-on-surface-variant mb-2">
                    📍 {upvoteTargetComplaint.address || address}
                  </p>
                  {upvoteTargetComplaint.description && (
                    <p className="text-xs text-slate-700 dark:text-slate-300 italic bg-surface-container-lowest p-3 rounded-lg border border-outline-variant/20 mb-2">
                      "{upvoteTargetComplaint.description}"
                    </p>
                  )}
                  <p className="text-xs text-primary font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">how_to_reg</span>
                    Currently supported by {upvoteTargetComplaint.upvotes || 0} citizens
                  </p>
                </div>

                {/* Contact Details Only Form */}
                <div className="space-y-4">
                  <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-outline font-bold">
                          Reporting Mode
                        </p>
                        <p className="font-body-md text-on-surface mt-1">
                          {isAnonymous
                            ? "Anonymous upvote"
                            : user
                            ? "Registered citizen upvote"
                            : "Public upvote without sign-in"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAnonymous((prev) => !prev)}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${isAnonymous ? "bg-primary" : "bg-outline-variant"}`}
                        aria-label="Toggle anonymous reporting"
                      >
                        <span
                          className={`inline-block h-5 w-5 rounded-full bg-white transition ${isAnonymous ? "translate-x-6" : "translate-x-1"}`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="font-label-md text-label-md text-on-surface uppercase font-semibold block mb-2">
                        Your Name
                      </label>
                      <input
                        value={reporterName}
                        onChange={(e) => setReporterName(e.target.value)}
                        placeholder={isAnonymous ? "Anonymous Citizen" : "Full name"}
                        className="w-full p-3 rounded-xl border border-outline-variant bg-transparent text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                        readOnly={!!user && !isAnonymous}
                      />
                    </div>
                    <div>
                      <label className="font-label-md text-label-md text-on-surface uppercase font-semibold block mb-2">
                        Contact Phone <span className="text-error">*</span>
                      </label>
                      <input
                        type="tel"
                        value={reporterPhone}
                        onChange={(e) => setReporterPhone(e.target.value)}
                        placeholder="9876543210"
                        className="w-full p-3 rounded-xl border border-outline-variant bg-transparent text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                        readOnly={!!user && !isAnonymous}
                        required
                      />
                      <p className="text-[11px] text-outline mt-1">
                        Required to verify your upvote and prevent duplicate voting.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-emerald-600 shrink-0">check_circle</span>
                    <span>You are supporting report <strong>#{upvoteTargetComplaint.complaintId}</strong>. No duplicate complaint will be created.</span>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-8 pt-6 border-t border-outline-variant/20">
                  <button
                    type="button"
                    onClick={() => {
                      setUpvoteTargetComplaint(null);
                    }}
                    className="px-6 py-2.5 border border-outline-variant text-on-surface-variant font-label-md rounded-lg hover:bg-surface-container-low flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-base">arrow_back</span>
                    Choose Other Option
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmUpvote}
                    disabled={upvotingComplaintId === upvoteTargetComplaint.complaintId || (!isAuthenticated && (!reporterPhone || reporterPhone.trim().length < 8))}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-lg font-label-md text-label-md shadow-sm flex items-center gap-2 disabled:opacity-50 transition-all font-bold cursor-pointer"
                  >
                    <span className="material-symbols-outlined">thumb_up</span>
                    {upvotingComplaintId === upvoteTargetComplaint.complaintId
                      ? "Recording Upvote..."
                      : `Confirm Upvote for #${upvoteTargetComplaint.complaintId}`}
                  </button>
                </div>
              </div>
            ) : nearbyComplaints.length > 0 && !proceedAsNewIssue ? (
              /* BRANCH 2: Similar Issue Detected - User Chooses Between Upvoting or Creating New Issue */
              <div className="bg-surface-container-lowest rounded-xl p-6 md:p-8 border border-outline-variant/30 civic-glow">
                <h2 className="font-headline-sm text-headline-sm text-on-surface mb-2 font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-600">
                    warning
                  </span>
                  Similar Issue Already Reported Nearby
                </h2>
                <p className="font-body-md text-on-surface-variant mb-6">
                  We found {nearbyComplaints.length} existing {selectedCategoryObj?.title || selectedCategory} report within 50m of your location. Choose whether to support the existing report or create a new distinct issue.
                </p>

                {/* Existing Complaints Cards */}
                <div className="space-y-4 mb-6">
                  {nearbyComplaints.map((complaint) => (
                    <div
                      key={complaint.complaintId}
                      className="rounded-xl border-2 border-primary/30 bg-surface-container-lowest p-5 shadow-sm hover:border-primary transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-bold text-on-surface text-base font-mono">
                              #{complaint.complaintId}
                            </span>
                            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-primary-fixed/40 text-primary uppercase">
                              {complaint.status}
                            </span>
                            <span className="text-xs text-outline font-medium">
                              • {complaint.distanceMeters}m away
                            </span>
                          </div>
                          {complaint.description && (
                            <p className="text-sm text-on-surface-variant mb-1 line-clamp-2">
                              "{complaint.description}"
                            </p>
                          )}
                          {complaint.address && (
                            <p className="text-xs text-outline truncate">
                              📍 {complaint.address}
                            </p>
                          )}
                        </div>

                        <div className="shrink-0">
                          <button
                            type="button"
                            onClick={() => handleSelectComplaintForUpvote(complaint)}
                            className="bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container px-6 py-3 rounded-xl font-label-md text-sm font-bold flex items-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-base">thumb_up</span>
                            <span>Upvote ({complaint.upvotes || 0})</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Option to proceed with new issue */}
                <div className="p-5 rounded-xl border border-outline-variant/40 bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-on-surface text-sm flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-outline">alt_route</span>
                      Is your civic issue different or distinct?
                    </h4>
                    <p className="text-xs text-on-surface-variant mt-1">
                      If the hazard you are reporting is not the same as the report(s) above, you can continue to file a new complaint.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProceedAsNewIssue(true);
                      setUpvoteTargetComplaint(null);
                    }}
                    className="shrink-0 px-6 py-2.5 bg-surface-container-highest hover:bg-surface-variant text-on-surface font-bold text-xs uppercase tracking-wider rounded-lg border border-outline-variant flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <span>Continue as not the same issue</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>

                <div className="flex justify-start mt-6 pt-4 border-t border-outline-variant/20">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="px-6 py-2.5 border border-outline-variant text-on-surface-variant font-label-md rounded-lg hover:bg-surface-container-low flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-base">arrow_back</span>
                    Back to Location
                  </button>
                </div>
              </div>
            ) : (
              /* BRANCH 3: Standard New Complaint Form */
              <div className="bg-surface-container-lowest rounded-xl p-6 md:p-8 border border-outline-variant/30 civic-glow">
                <h2 className="font-headline-sm text-headline-sm text-on-surface mb-2 font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">
                    description
                  </span>
                  Detailed Description & Contact Details
                </h2>
                <p className="font-body-md text-on-surface-variant mb-6">
                  Provide context for municipal field workers to easily locate and
                  resolve the hazard.
                </p>

                {nearbyComplaints.length > 0 && (
                  <div className="mb-6 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-medium">
                      <span className="material-symbols-outlined text-base text-amber-600">info</span>
                      <span>Filing as a separate, distinct complaint.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setProceedAsNewIssue(false);
                        setUpvoteTargetComplaint(null);
                      }}
                      className="text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-xs">thumb_up</span>
                      <span>Wait, upvote existing report instead?</span>
                    </button>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-outline font-bold">
                          Reporting Mode
                        </p>
                        <p className="font-body-md text-on-surface mt-1">
                          {isAnonymous
                            ? "Anonymous report"
                            : user
                              ? "Registered citizen report"
                              : "Public report without sign-in"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAnonymous((prev) => !prev)}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${isAnonymous ? "bg-primary" : "bg-outline-variant"}`}
                        aria-label="Toggle anonymous reporting"
                      >
                        <span
                          className={`inline-block h-5 w-5 rounded-full bg-white transition ${isAnonymous ? "translate-x-6" : "translate-x-1"}`}
                        />
                      </button>
                    </div>
                    {!isAuthenticated && !isAnonymous && (
                      <p className="mt-2 text-xs text-error">
                        You are not signed in. Sign in to use your profile or choose
                        anonymous reporting.
                      </p>
                    )}
                  </div>

                  {isAnonymous && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="font-label-md text-label-md text-on-surface uppercase font-semibold block mb-2">
                          Reporter Name
                        </label>
                        <input
                          value={reporterName}
                          onChange={(e) => setReporterName(e.target.value)}
                          placeholder={isAnonymous ? "Anonymous" : "Full name"}
                          className="w-full p-3 rounded-xl border border-outline-variant bg-transparent text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                          readOnly={!!user && !isAnonymous}
                        />
                      </div>
                      <div>
                        <label className="font-label-md text-label-md text-on-surface uppercase font-semibold block mb-2">
                          Contact Phone {isAnonymous ? " *" : ""}
                        </label>
                        <input
                          value={reporterPhone}
                          onChange={(e) => setReporterPhone(e.target.value)}
                          placeholder="9876543210"
                          className="w-full p-3 rounded-xl border border-outline-variant bg-transparent text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                          readOnly={!!user && !isAnonymous}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="font-label-md text-label-md text-on-surface uppercase font-semibold block mb-2">
                      Issue Description <span className="text-error">*</span>
                    </label>
                    <textarea
                      rows={5}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Deep pothole near intersection causing vehicle damage and traffic bottleneck during rush hour..."
                      className="w-full p-4 rounded-xl border border-outline-variant bg-transparent text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-body-md resize-none"
                      required
                    ></textarea>
                    <div className="flex justify-between text-xs text-outline mt-1">
                      <span>Minimum 10 characters recommended</span>
                      <span>{description.length}/2000</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-8 pt-6 border-t border-outline-variant/20">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="px-6 py-2.5 border border-outline-variant text-on-surface-variant font-label-md rounded-lg hover:bg-surface-container-low"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!description || description.trim().length < 5) {
                        setError(
                          "Please provide a detailed description of the issue.",
                        );
                        return;
                      }
                      if (!isAuthenticated && !isAnonymous) {
                        setError(
                          "Please sign in or choose the anonymous reporting option.",
                        );
                        return;
                      }
                      if (
                        isAnonymous &&
                        (!reporterPhone || reporterPhone.trim().length < 8)
                      ) {
                        setError(
                          "Please add a valid contact phone number for anonymous reporting.",
                        );
                        return;
                      }
                      setError("");
                      setCurrentStep(5);
                    }}
                    className="bg-primary text-on-primary px-8 py-3 rounded-lg font-label-md text-label-md hover:bg-primary-container shadow-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    Continue to Review
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 5: REVIEW & SUBMIT */}
        {currentStep === 5 && (
          <div className="bg-surface-container-lowest rounded-xl p-6 md:p-8 border border-outline-variant/30 civic-glow">
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-2 font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">
                fact_check
              </span>
              Review Your Report
            </h2>
            <p className="font-body-md text-on-surface-variant mb-8">
              Verify your information before final dispatch to the municipal
              department.
            </p>

            {error && (
              <div className="p-4 mb-6 rounded-xl bg-error-container/30 border border-error/30 text-error flex items-center gap-3 text-sm">
                <span className="material-symbols-outlined shrink-0">
                  error
                </span>
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Reporter Info */}
              <div className="md:col-span-2 p-4 rounded-xl bg-surface-container-low border border-outline-variant/20">
                <span className="text-xs font-bold text-outline uppercase tracking-wider block">
                  Reporting Mode
                </span>
                <p className="font-headline-sm text-on-surface font-bold text-base mt-0.5">
                  {isAnonymous
                    ? `${reporterName || "Anonymous"} (anonymous)`
                    : "Registered account report"}
                </p>
                {isAnonymous && (
                  <p className="font-mono text-primary font-bold text-base mt-1">
                    Contact: {reporterPhone || "N/A"}
                  </p>
                )}
              </div>

              {/* Category & Department */}
              <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20">
                <span className="text-xs font-bold text-outline uppercase tracking-wider">
                  Category
                </span>
                <h4 className="font-headline-sm text-on-surface mt-1 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">
                    {selectedCategoryObj?.icon}
                  </span>
                  {selectedCategoryObj?.title}
                </h4>
              </div>

              {/* Location & Landmark Details */}
              <div className="md:col-span-2 p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 grid grid-cols-1 md:grid-cols-2 gap-4">
                {duplicateInfo && (
                  <div className="md:col-span-2 p-3 rounded-lg bg-error-container/30 border border-error/30 text-error text-xs">
                    Duplicate warning: a similar complaint was already reported
                    nearby ({duplicateInfo.complaintId}).
                  </div>
                )}
                <div>
                  <span className="text-xs font-bold text-outline uppercase tracking-wider block mb-1">
                    Landmark Details (Map Auto-Detected)
                  </span>
                  <p className="font-body-sm text-on-surface-variant font-medium whitespace-pre-wrap">
                    {landmarkDetails || "Auto-Detected GPS Location"}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-bold text-outline uppercase tracking-wider block mb-1">
                    Full Address (User Entered)
                  </span>
                  <p className="font-body-md text-on-surface font-medium whitespace-pre-wrap">
                    {address}
                  </p>
                </div>
                <div className="md:col-span-2 text-xs text-outline mt-1 border-t border-outline-variant/10 pt-2">
                  Lat: {position[0].toFixed(5)}, Lng: {position[1].toFixed(5)}{" "}
                  (GPS Position Locked)
                </div>
              </div>

              {/* Description */}
              <div className="md:col-span-2 p-4 rounded-xl bg-surface-container-low border border-outline-variant/20">
                <span className="text-xs font-bold text-outline uppercase tracking-wider">
                  Description
                </span>
                <p className="font-body-md text-on-surface mt-1 whitespace-pre-wrap">
                  {description}
                </p>
              </div>

              {/* Photos */}
              {filePreviews.length > 0 && (
                <div className="md:col-span-2 p-4 rounded-xl bg-surface-container-low border border-outline-variant/20">
                  <span className="text-xs font-bold text-outline uppercase tracking-wider block mb-2">
                    Live Evidence Photos ({filePreviews.length})
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {filePreviews.map((preview, i) => (
                      <img
                        key={i}
                        src={preview}
                        alt="Evidence preview"
                        className="w-20 h-20 object-cover rounded-lg border border-outline-variant/30"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center mt-8 pt-6 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="px-6 py-2.5 border border-outline-variant text-on-surface-variant font-label-md rounded-lg hover:bg-surface-container-low"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmitReport}
                disabled={submitting}
                className="bg-primary text-on-primary px-8 py-3 rounded-lg font-label-md text-label-md hover:bg-primary-container shadow-level-1 hover:shadow-level-2 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <span className="material-symbols-outlined">send</span>
                {submitting
                  ? "Transmitting to Server..."
                  : "Confirm & Submit Issue"}
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: CONFIRMATION & PRINTABLE COMPLAINT / UPVOTE SLIP */}
        {currentStep === 6 && (submittedComplaint || upvoteSuccessData) && (
          <div className="space-y-8 max-w-2xl mx-auto">
            <style>{`
              @media print {
                body * {
                  visibility: hidden;
                }
                #printable-complaint-slip, #printable-complaint-slip * {
                  visibility: visible;
                }
                #printable-complaint-slip {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  border: 2px solid #000 !important;
                  box-shadow: none !important;
                  background: #fff !important;
                  color: #000 !important;
                  padding: 24px !important;
                }
              }
            `}</style>

            {upvoteSuccessData ? (
              /* UPVOTE CONFIRMATION RECEIPT */
              <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/30 civic-glow text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-3xl">thumb_up</span>
                </div>

                <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2 font-extrabold">
                  Upvote Recorded Successfully!
                </h2>
                <p className="font-body-md text-on-surface-variant max-w-md mx-auto mb-6">
                  You have successfully validated and supported complaint{" "}
                  <strong className="text-primary font-mono">
                    #{upvoteSuccessData.complaintId}
                  </strong>.
                </p>

                {/* Printable Upvote Slip Card */}
                <div
                  id="printable-complaint-slip"
                  className="bg-white text-slate-900 rounded-2xl p-6 border-2 border-slate-200 shadow-md text-left space-y-4 my-6"
                >
                  <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                    <div>
                      <div className="flex items-center gap-2 font-extrabold text-lg text-blue-950">
                        <span className="material-symbols-outlined text-blue-700">account_balance</span>
                        CivicPulse Municipal Governance Portal
                      </div>
                      <p className="text-xs text-slate-500 font-medium">
                        Official Citizen Upvote & Issue Validation Slip
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block bg-emerald-100 text-emerald-900 text-xs font-mono font-bold px-3 py-1 rounded-md border border-emerald-300">
                        UPVOTED #{upvoteSuccessData.complaintId}
                      </span>
                      <p className="text-[10px] text-slate-500 mt-1 font-semibold uppercase">
                        Status: {upvoteSuccessData.status || "SUBMITTED"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 uppercase font-semibold text-[10px]">
                        Target Complaint ID
                      </span>
                      <p className="font-mono font-bold text-slate-900 text-sm">
                        #{upvoteSuccessData.complaintId}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 uppercase font-semibold text-[10px]">
                        Upvote Timestamp
                      </span>
                      <p className="font-semibold text-slate-900">
                        {new Date().toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 uppercase font-semibold text-[10px]">
                        Hazard Category
                      </span>
                      <p className="font-semibold text-slate-900 capitalize">
                        {upvoteSuccessData.category ? upvoteSuccessData.category.replace("_", " ") : selectedCategory}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 uppercase font-semibold text-[10px]">
                        Community Support
                      </span>
                      <p className="font-bold text-emerald-700">
                        {upvoteSuccessData.upvotes} Citizens Upvoted
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 uppercase font-semibold text-[10px]">
                        Voter Phone
                      </span>
                      <p className="font-mono font-semibold text-slate-900">
                        {upvoteSuccessData.voterPhone || "Verified"}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 uppercase font-semibold text-[10px]">
                        Assigned Authority
                      </span>
                      <p className="font-bold text-blue-800">
                        {upvoteSuccessData.department || "Municipal Department"}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <span className="text-slate-500 uppercase font-semibold text-[10px]">
                      Location
                    </span>
                    <p className="text-xs text-slate-800 font-medium mt-0.5">
                      {upvoteSuccessData.address || address}
                    </p>
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <span className="text-slate-500 uppercase font-semibold text-[10px]">
                      Reported Hazard Description
                    </span>
                    <p className="text-xs text-slate-700 italic mt-0.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      "{upvoteSuccessData.description || "Civic hazard in the locality."}"
                    </p>
                  </div>

                  <div className="border-t border-dashed border-slate-300 pt-3 bg-emerald-50/50 p-3 rounded-xl flex items-start gap-2">
                    <span className="material-symbols-outlined text-base text-emerald-600 mt-0.5 shrink-0">verified</span>
                    <div>
                      <p className="text-xs font-semibold text-emerald-900">
                        Duplicate Prevention Verified
                      </p>
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        By upvoting this existing complaint instead of filing a duplicate report, you have escalated this hazard's priority without creating extra backlog for municipal field crews.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-center gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="bg-primary text-on-primary font-label-md text-label-md px-8 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-primary-container shadow-level-1 hover:shadow-level-2 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">download</span>
                    Download / Print Upvote Slip
                  </button>

                  <Link
                    to="/dashboard"
                    className="bg-surface text-primary border border-outline-variant font-label-md text-label-md px-8 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-surface-container-low transition-all"
                  >
                    Go to Dashboard
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFiles([]);
                      setDescription("");
                      setSubmittedComplaint(null);
                      setUpvoteSuccessData(null);
                      setUpvoteTargetComplaint(null);
                      setProceedAsNewIssue(false);
                      setCurrentStep(1);
                    }}
                    className="bg-surface text-primary border border-outline-variant font-label-md text-label-md px-8 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-surface-container-low transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">add</span>
                    Report Another Issue
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/30 civic-glow text-center">

              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl">
                  check_circle
                </span>
              </div>

              <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2 font-extrabold">
                Complaint Registered Successfully!
              </h2>
              <p className="font-body-md text-on-surface-variant max-w-md mx-auto mb-6">
                Your report has been assigned reference ID{" "}
                <strong className="text-primary font-mono">
                  {submittedComplaint.complaintId}
                </strong>{" "}
                and dispatched to the{" "}
                <strong className="text-primary">
                  {submittedComplaint.department}
                </strong>
                .
              </p>

              {/* Official Printable Complaint Slip Card */}
              <div
                id="printable-complaint-slip"
                className="bg-white text-slate-900 rounded-2xl p-6 border-2 border-slate-200 shadow-md text-left space-y-4 my-6"
              >
                <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                  <div>
                    <div className="flex items-center gap-2 font-extrabold text-lg text-blue-950">
                      <span className="material-symbols-outlined text-blue-700">
                        account_balance
                      </span>
                      CivicPulse Municipal Governance Portal
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      Official Citizen Complaint Slip & Tracking Receipt
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block bg-blue-100 text-blue-900 text-xs font-mono font-bold px-3 py-1 rounded-md border border-blue-300">
                      {submittedComplaint.complaintId}
                    </span>
                    <p className="text-[10px] text-slate-500 mt-1 font-semibold uppercase">
                      Status: SUBMITTED
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 uppercase font-semibold text-[10px]">
                      Reference Number
                    </span>
                    <p className="font-mono font-bold text-slate-900 text-sm">
                      {submittedComplaint.complaintId}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase font-semibold text-[10px]">
                      Filing Date & Time
                    </span>
                    <p className="font-semibold text-slate-900">
                      {submittedComplaint.createdAt
                        ? new Date(
                            submittedComplaint.createdAt,
                          ).toLocaleString()
                        : new Date().toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase font-semibold text-[10px]">
                      Assigned Department
                    </span>
                    <p className="font-bold text-blue-800">
                      {submittedComplaint.department || "Municipal Department"}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase font-semibold text-[10px]">
                      Registered Phone Number
                    </span>
                    <p className="font-mono font-semibold text-slate-900">
                      {user?.phone || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase font-semibold text-[10px]">
                      Issue Category
                    </span>
                    <p className="font-semibold text-slate-900 capitalize">
                      {submittedComplaint.category
                        ? submittedComplaint.category.replace("_", " ")
                        : selectedCategory}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase font-semibold text-[10px]">
                      Priority Rating
                    </span>
                    <p className="font-semibold text-slate-900">
                      {submittedComplaint.priority || "MEDIUM"}
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <span className="text-slate-500 uppercase font-semibold text-[10px]">
                    Location Address
                  </span>
                  <p className="text-xs text-slate-800 font-medium mt-0.5">
                    {submittedComplaint.address || address}
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <span className="text-slate-500 uppercase font-semibold text-[10px]">
                    Description
                  </span>
                  <p className="text-xs text-slate-700 italic mt-0.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    "{submittedComplaint.description || description}"
                  </p>
                </div>

                {/* Barcode Mock Visual */}
                <div className="border-t border-dashed border-slate-300 pt-4 flex justify-between items-center text-[10px] text-slate-500">
                  <div>
                    <p className="font-semibold text-slate-700">
                      Keep this slip for your records.
                    </p>
                    <p>
                      Track status anytime on CivicPulse using Complaint ID:{" "}
                      {submittedComplaint.complaintId}
                    </p>
                  </div>
                  <div className="font-mono text-center">
                    <div className="tracking-[4px] font-bold text-xs">
                      ||| |||| | ||||| |||
                    </div>
                    <span>{submittedComplaint.complaintId}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-primary text-on-primary font-label-md text-label-md px-8 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-primary-container shadow-level-1 hover:shadow-level-2 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">
                    download
                  </span>
                  Download / Print Complaint Slip
                </button>

                <Link
                  to="/dashboard"
                  className="bg-surface text-primary border border-outline-variant font-label-md text-label-md px-8 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-surface-container-low transition-all"
                >
                  Go to Dashboard
                </Link>
              </div>
            </div>
            )}
          </div>
        )}
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default ReportIssuePage;
