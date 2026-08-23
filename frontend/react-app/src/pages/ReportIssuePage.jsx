import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import DashboardNavbar from '../components/layout/DashboardNavbar';
import MobileBottomNav from '../components/layout/MobileBottomNav';
import { complaintService } from '../services/complaintService';

// Custom high-visibility civic location pin
const customPinIcon = L.divIcon({
  className: 'custom-civic-pin',
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

const reverseGeocode = async (lat, lng, setAddress) => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
    );
    const data = await res.json();
    if (data && data.display_name) {
      setAddress((prev) => (prev ? prev : data.display_name));
    }
  } catch (err) {
    console.error('Geocoding error:', err);
  }
};

const ReportIssuePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Wizard state (1: Category, 2: Evidence, 3: Location, 4: Details, 5: Review, 6: Success)
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);

  // Camera stream state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Location state (Non-editable map, auto-detected GPS)
  const [position, setPosition] = useState([28.6139, 77.209]); // Default: Delhi
  const [address, setAddress] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [gpsDetected, setGpsDetected] = useState(false);

  // Details state
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedComplaint, setSubmittedComplaint] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const categoryParam = searchParams.get('category');
    if (categoryParam) {
      setSelectedCategory(categoryParam);
    }
  }, [searchParams]);

  // Handle camera stream initialization & cleanup
  useEffect(() => {
    if (currentStep === 2) {
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
    if (currentStep === 3 && !gpsDetected) {
      handleDetectGPS();
    }
  }, [currentStep]);

  const startCamera = async () => {
    setCameraError('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera API is not supported on this browser. Use mobile camera capture below.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Rear camera on mobile
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
      console.warn('Live webcam stream not accessible, fallback to native camera:', err);
      setCameraActive(false);
      setCameraError('Please allow camera permissions or tap "Open Device Camera" below.');
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
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `live_photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const previewUrl = URL.createObjectURL(blob);

        setSelectedFiles((prev) => [...prev, file].slice(0, 5));
        setFilePreviews((prev) => [...prev, previewUrl].slice(0, 5));
      },
      'image/jpeg',
      0.9
    );
  };

  const handleNativeCameraCapture = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newFiles = [...selectedFiles, ...files].slice(0, 5);
    setSelectedFiles(newFiles);

    const previews = newFiles.map((file) => URL.createObjectURL(file));
    setFilePreviews(previews);
  };

  const handleRemoveFile = (index) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const newPreviews = filePreviews.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    setFilePreviews(newPreviews);
  };

  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPosition([latitude, longitude]);
        reverseGeocode(latitude, longitude, setAddress);
        setIsLocating(false);
        setGpsDetected(true);
      },
      (err) => {
        console.error('GPS error:', err);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const categories = [
    {
      key: 'pothole',
      title: 'Pothole',
      description: 'Report deep holes, sunken covers, or severe road degradation.',
      icon: 'landscape',
    },
    {
      key: 'broken_streetlight',
      title: 'Broken Streetlight',
      description: 'Flickering, completely out, or damaged street illumination.',
      icon: 'lightbulb',
    },
    {
      key: 'garbage',
      title: 'Garbage / Waste',
      description: 'Illegal dumping, missed collections, or overflowing public bins.',
      icon: 'delete',
    },
    {
      key: 'drainage',
      title: 'Drainage & Sewage',
      description: 'Blocked drains, localized flooding, or sewage leaks.',
      icon: 'water_drop',
    },
    {
      key: 'water_issue',
      title: 'Water Supply',
      description: 'Burst pipes, low pressure, or suspected water contamination.',
      icon: 'plumbing',
    },
    {
      key: 'public_property',
      title: 'Public Infrastructure',
      description: 'Damaged bus stops, broken benches, or playground hazards.',
      icon: 'construction',
    },
    {
      key: 'road_damage',
      title: 'Road Damage',
      description: 'Faded markings, damaged signs, or sidewalk issues.',
      icon: 'add_road',
    },
    {
      key: 'other',
      title: 'Other Civic Issue',
      description: 'Anything else that requires municipal attention and action.',
      icon: 'category',
    },
  ];

  const handleSubmitReport = async () => {
    if (!selectedCategory || !description || !address) {
      setError('Please complete all required fields including your full address.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('category', selectedCategory);
      formData.append('description', description);
      formData.append('latitude', position[0]);
      formData.append('longitude', position[1]);
      formData.append('address', address);

      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });

      const response = await complaintService.createComplaint(formData);
      if (response && response.complaint) {
        setSubmittedComplaint(response.complaint);
        setCurrentStep(6); // Success Step
      }
    } catch (err) {
      console.error('Submission error:', err);
      setError(
        err.response?.data?.message || 'Failed to submit complaint. Please check your connection and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const getStepProgressPercentage = () => {
    switch (currentStep) {
      case 1:
        return '0%';
      case 2:
        return '25%';
      case 3:
        return '50%';
      case 4:
        return '75%';
      case 5:
      case 6:
        return '100%';
      default:
        return '0%';
    }
  };

  const selectedCategoryObj = categories.find((c) => c.key === selectedCategory);

  return (
    <div className="bg-background text-on-background min-h-screen font-body-md selection:bg-primary-container selection:text-on-primary-container pb-24 md:pb-12 pt-16">
      <DashboardNavbar />

      <main className="pt-8 pb-section-gap px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        {/* Header & Stepper Section */}
        <div className="mb-12">
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-2 font-bold">
            Report an Issue
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mb-8">
            {currentStep === 1 && 'Select the category that best describes the problem.'}
            {currentStep === 2 && 'Capture live photo evidence using your camera.'}
            {currentStep === 3 && 'Location auto-detected via GPS. Enter your full address.'}
            {currentStep === 4 && 'Describe the hazard and severity for the field team.'}
            {currentStep === 5 && 'Review all details before transmitting to the department.'}
            {currentStep === 6 && 'Complaint successfully dispatched to city administration.'}
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

              {/* Step 1: Category */}
              <div
                className="relative z-10 flex flex-col items-center gap-2 cursor-pointer"
                onClick={() => setCurrentStep(1)}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-label-md text-label-md ring-4 ring-background transition-all ${
                    currentStep >= 1
                      ? 'bg-primary text-on-primary font-bold'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  1
                </div>
                <span
                  className={`font-label-md text-label-md hidden md:block ${
                    currentStep >= 1 ? 'text-primary font-bold' : 'text-on-surface-variant'
                  }`}
                >
                  Category
                </span>
              </div>

              {/* Step 2: Evidence */}
              <div
                className={`relative z-10 flex flex-col items-center gap-2 ${
                  selectedCategory ? 'cursor-pointer' : ''
                }`}
                onClick={() => selectedCategory && setCurrentStep(2)}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-label-md text-label-md ring-4 ring-background transition-all ${
                    currentStep >= 2
                      ? 'bg-primary text-on-primary font-bold'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  2
                </div>
                <span
                  className={`font-label-md text-label-md hidden md:block ${
                    currentStep >= 2 ? 'text-primary font-bold' : 'text-on-surface-variant'
                  }`}
                >
                  Evidence
                </span>
              </div>

              {/* Step 3: Location */}
              <div
                className={`relative z-10 flex flex-col items-center gap-2 ${
                  selectedCategory ? 'cursor-pointer' : ''
                }`}
                onClick={() => selectedCategory && setCurrentStep(3)}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-label-md text-label-md ring-4 ring-background transition-all ${
                    currentStep >= 3
                      ? 'bg-primary text-on-primary font-bold'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  3
                </div>
                <span
                  className={`font-label-md text-label-md hidden md:block ${
                    currentStep >= 3 ? 'text-primary font-bold' : 'text-on-surface-variant'
                  }`}
                >
                  Location
                </span>
              </div>

              {/* Step 4: Details */}
              <div
                className={`relative z-10 flex flex-col items-center gap-2 ${
                  selectedCategory ? 'cursor-pointer' : ''
                }`}
                onClick={() => selectedCategory && setCurrentStep(4)}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-label-md text-label-md ring-4 ring-background transition-all ${
                    currentStep >= 4
                      ? 'bg-primary text-on-primary font-bold'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  4
                </div>
                <span
                  className={`font-label-md text-label-md hidden md:block ${
                    currentStep >= 4 ? 'text-primary font-bold' : 'text-on-surface-variant'
                  }`}
                >
                  Details
                </span>
              </div>

              {/* Step 5: Review */}
              <div
                className={`relative z-10 flex flex-col items-center gap-2 ${
                  selectedCategory && description ? 'cursor-pointer' : ''
                }`}
                onClick={() => selectedCategory && description && setCurrentStep(5)}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-label-md text-label-md ring-4 ring-background transition-all ${
                    currentStep >= 5
                      ? 'bg-primary text-on-primary font-bold'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  5
                </div>
                <span
                  className={`font-label-md text-label-md hidden md:block ${
                    currentStep >= 5 ? 'text-primary font-bold' : 'text-on-surface-variant'
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
            <span className="material-symbols-outlined text-xl shrink-0 mt-0.5">error</span>
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* STEP 1: CATEGORY SELECTION (Stitch Exact UI) */}
        {currentStep === 1 && (
          <div>
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
                        ? 'ring-2 ring-primary bg-surface-container-low border-primary'
                        : 'bg-surface-container-lowest border-surface-container-highest'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined text-primary" data-icon={cat.icon}>
                        {cat.icon}
                      </span>
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2 font-bold">
                      {cat.title}
                    </h3>
                    <p className="font-body-md text-body-md text-on-surface-variant">{cat.description}</p>
                  </button>
                );
              })}
            </div>

            {/* Next Step Action */}
            <div className="mt-12 flex justify-end">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                disabled={!selectedCategory}
                className={`bg-primary text-on-primary px-8 py-3 rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors shadow-sm flex items-center gap-2 ${
                  !selectedCategory ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-level-2'
                }`}
              >
                Continue to Evidence
                <span className="material-symbols-outlined" data-icon="arrow_forward">
                  arrow_forward
                </span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: LIVE PHOTO CAPTURE ONLY */}
        {currentStep === 2 && (
          <div className="bg-surface-container-lowest rounded-xl p-6 md:p-8 border border-outline-variant/30 civic-glow">
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-2 font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">photo_camera</span>
              Take Live Photo Evidence
            </h2>
            <p className="font-body-md text-on-surface-variant mb-6">
              Use your device camera to snap live on-site evidence of the issue (Max 5 photos).
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
                  className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                />

                {!cameraActive && (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-white/80">
                    <span className="material-symbols-outlined text-5xl mb-2 text-primary">videocam</span>
                    <p className="text-sm font-semibold mb-3">Live Camera Viewfinder</p>
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

              {/* Shutter Capture Controls */}
              <div className="flex flex-wrap items-center justify-center gap-4">
                {cameraActive && (
                  <button
                    type="button"
                    onClick={captureLivePhoto}
                    disabled={selectedFiles.length >= 5}
                    className="px-8 py-3.5 bg-primary text-on-primary font-bold font-label-md rounded-xl hover:bg-primary-container shadow-level-1 flex items-center gap-2 disabled:opacity-50 transition-all transform active:scale-95"
                  >
                    <span className="material-symbols-outlined text-xl">photo_camera</span>
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
                  <span className="material-symbols-outlined text-xl">camera_alt</span>
                  Open Device Camera
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
              </div>
            </div>

            {/* Captured Photos Gallery */}
            {filePreviews.length > 0 ? (
              <div className="mb-8">
                <h4 className="font-label-md text-on-surface mb-3 font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-base">check_circle</span>
                  Captured Evidence Photos ({filePreviews.length}/5)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  {filePreviews.map((preview, idx) => (
                    <div key={idx} className="relative rounded-lg overflow-hidden border border-outline-variant/30 h-28 group shadow-sm">
                      <img src={preview} alt={`Captured ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        className="absolute top-1 right-1 w-7 h-7 rounded-full bg-error text-white flex items-center justify-center shadow-md hover:bg-red-700 transition-colors"
                        aria-label="Remove captured photo"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-outline italic text-center mb-6">
                No live photos captured yet. You can capture up to 5 photos or continue to location.
              </p>
            )}

            <div className="flex justify-between items-center mt-8 pt-6 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-6 py-2.5 border border-outline-variant text-on-surface-variant font-label-md rounded-lg hover:bg-surface-container-low"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="bg-primary text-on-primary px-8 py-3 rounded-lg font-label-md text-label-md hover:bg-primary-container shadow-sm flex items-center gap-2"
              >
                Continue to Location
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
                  <span className="material-symbols-outlined text-primary">location_on</span>
                  Auto-Detected Location & Address
                </h2>
                <p className="text-sm text-on-surface-variant">
                  Your coordinates are automatically tagged via GPS. Please enter your complete street address below.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDetectGPS}
                disabled={isLocating}
                className="px-5 py-2.5 bg-primary-fixed text-on-primary-fixed-variant rounded-lg font-label-md flex items-center gap-2 hover:bg-primary-fixed-dim transition-colors shadow-sm disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">
                  {isLocating ? 'sync' : 'my_location'}
                </span>
                {isLocating ? 'Detecting GPS...' : 'Re-Detect GPS Location'}
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
                style={{ height: '100%', width: '100%' }}
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
                GPS Position Locked: {position[0].toFixed(5)}, {position[1].toFixed(5)}
              </div>
            </div>

            {/* Full Address Input Form */}
            <div className="space-y-4">
              <div>
                <label className="font-label-md text-label-md text-on-surface uppercase font-bold block mb-2">
                  Enter Full Address & Landmark Details <span className="text-error">*</span>
                </label>
                <textarea
                  rows={3}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. House No. 42, Main Market Road, Near City Park Gate 2, Ward 14, New Delhi - 110001"
                  className="w-full p-4 rounded-xl border border-outline-variant bg-transparent text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-body-md resize-none shadow-sm"
                  required
                />
                <p className="text-xs text-outline mt-1">
                  Please provide a detailed address including house/street number and nearby landmarks for the field repair crew.
                </p>
              </div>
            </div>

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
                onClick={() => setCurrentStep(4)}
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
          <div className="bg-surface-container-lowest rounded-xl p-6 md:p-8 border border-outline-variant/30 civic-glow">
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-2 font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">description</span>
              Detailed Description
            </h2>
            <p className="font-body-md text-on-surface-variant mb-6">
              Provide context such as dimensions, traffic disruption, or safety risks for citizens.
            </p>

            <div className="space-y-4">
              <div>
                <label className="font-label-md text-label-md text-on-surface uppercase font-semibold block mb-2">
                  Issue Description
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
                onClick={() => setCurrentStep(5)}
                disabled={!description || description.trim().length < 5}
                className="bg-primary text-on-primary px-8 py-3 rounded-lg font-label-md text-label-md hover:bg-primary-container shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                Continue to Review
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: REVIEW & SUBMIT */}
        {currentStep === 5 && (
          <div className="bg-surface-container-lowest rounded-xl p-6 md:p-8 border border-outline-variant/30 civic-glow">
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-2 font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">fact_check</span>
              Review Your Report
            </h2>
            <p className="font-body-md text-on-surface-variant mb-8">
              Verify your information before final dispatch to the municipal department.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Category & Department */}
              <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20">
                <span className="text-xs font-bold text-outline uppercase tracking-wider">Category</span>
                <h4 className="font-headline-sm text-on-surface mt-1 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">{selectedCategoryObj?.icon}</span>
                  {selectedCategoryObj?.title}
                </h4>
              </div>

              {/* Location */}
              <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20">
                <span className="text-xs font-bold text-outline uppercase tracking-wider">Full Address</span>
                <p className="font-body-md text-on-surface mt-1 font-medium whitespace-pre-wrap">{address}</p>
                <p className="text-xs text-outline mt-0.5">
                  Lat: {position[0].toFixed(5)}, Lng: {position[1].toFixed(5)} (GPS Locked)
                </p>
              </div>

              {/* Description */}
              <div className="md:col-span-2 p-4 rounded-xl bg-surface-container-low border border-outline-variant/20">
                <span className="text-xs font-bold text-outline uppercase tracking-wider">Description</span>
                <p className="font-body-md text-on-surface mt-1 whitespace-pre-wrap">{description}</p>
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
                {submitting ? 'Transmitting to Server...' : 'Confirm & Submit Issue'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: CONFIRMATION / SUCCESS MODAL */}
        {currentStep === 6 && submittedComplaint && (
          <div className="bg-surface-container-lowest rounded-2xl p-8 md:p-12 border border-outline-variant/30 civic-glow text-center max-w-2xl mx-auto">
            <div className="w-20 h-20 rounded-full bg-secondary-container/40 text-secondary flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-4xl">check_circle</span>
            </div>

            <span className="bg-primary-fixed text-on-primary-fixed font-label-sm text-sm px-4 py-1.5 rounded-full font-bold uppercase tracking-wider">
              {submittedComplaint.complaintId}
            </span>

            <h2 className="font-headline-xl text-headline-lg-mobile md:text-headline-lg text-on-surface mt-4 mb-2 font-bold">
              Complaint Registered Successfully!
            </h2>
            <p className="font-body-lg text-on-surface-variant max-w-md mx-auto mb-8">
              Your civic report has been assigned to the{' '}
              <strong className="text-primary">{submittedComplaint.department}</strong>. You can track progress in real-time.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                to={`/complaints/${submittedComplaint.id || ''}`}
                className="bg-primary text-on-primary font-label-md text-label-md px-8 py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-primary-container shadow-sm"
              >
                View Complaint Details
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </Link>
              <Link
                to="/dashboard"
                className="bg-surface text-primary border border-outline-variant font-label-md text-label-md px-8 py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-surface-container-low"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        )}
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default ReportIssuePage;
