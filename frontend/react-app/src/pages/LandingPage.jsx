import React from "react";
import { useNavigate } from "react-router-dom";
import LandingNavbar from "../components/layout/LandingNavbar";
import Footer from "../components/layout/Footer";
import CivicAnalyticsSection from "../components/CivicAnalyticsSection";
import NearbyIssuesSection from "../components/NearbyIssuesSection";
import heroImg from "../assets/images/hero image.png";
import bannerImg from "../assets/images/banner.jpeg";

const LandingPage = () => {
  const navigate = useNavigate();

  const handleReportClick = () => {
    navigate("/report");
  };

  const handleCategorySelect = (categoryKey) => {
    navigate(`/report?category=${categoryKey}`);
  };

  const categories = [
    {
      key: "pothole",
      title: "Pothole",
      description: "Road surface issues & asphalt damage",
      icon: "directions_car",
      bgClass: "bg-primary-container/10 text-primary",
    },
    {
      key: "broken_streetlight",
      title: "Broken Streetlight",
      description: "Non-functional or damaged lighting fixtures",
      icon: "lightbulb",
      bgClass: "bg-tertiary-container/10 text-tertiary",
    },
    {
      key: "garbage",
      title: "Garbage / Waste",
      description: "Overflowing dumpsters & uncollected waste",
      icon: "delete",
      bgClass: "bg-secondary-container/30 text-secondary",
    },
    {
      key: "drainage",
      title: "Drainage & Sewage",
      description: "Blocked drains, waterlogging & bad odors",
      icon: "waves",
      bgClass: "bg-primary-container/10 text-primary",
    },
    {
      key: "water_issue",
      title: "Water Supply",
      description: "Pipeline leaks, pressure drops & contaminated water",
      icon: "water_drop",
      bgClass: "bg-primary-container/10 text-primary",
    },
    {
      key: "public_property",
      title: "Public Infrastructure",
      description: "Damaged benches, parks & bus stops",
      icon: "account_balance",
      bgClass: "bg-error-container/30 text-error",
    },
    {
      key: "road_damage",
      title: "Road Damage",
      description: "Cracking, sink, potholes & speed bumps",
      icon: "traffic",
      bgClass: "bg-tertiary-container/10 text-tertiary",
    },
    {
      key: "other",
      title: "Other Civic Issue",
      description: "General municipal concerns & hazards",
      icon: "more_horiz",
      bgClass: "bg-surface-container-highest text-on-surface-variant",
    },
  ];

  return (
    <div className="bg-background text-on-background font-body-md antialiased overflow-x-hidden min-h-screen flex flex-col">
      <LandingNavbar />

      {/* Hero Section */}
      <section className="relative pt-24 md:pt-28 lg:pt-32 pb-14 md:pb-20 lg:pb-24 overflow-hidden bg-surface-container-lowest">
        <div className="max-w-container-max mx-auto grid md:grid-cols-2 gap-12 items-center md:pl-margin-desktop pl-margin-mobile">
          {/* Content */}
          <div className="flex flex-col items-start gap-6 z-20 py-6 md:py-10">
            <div className="inline-flex items-center gap-2 bg-surface-container-highest text-on-primary-fixed-variant px-4 py-2 rounded-full font-label-sm text-label-sm shadow-level-1">
              <span
                className="material-symbols-outlined text-secondary text-sm"
                data-icon="eco"
              >
                eco
              </span>
              <span>Empowering Communities Through Digital Governance</span>
            </div>

            <h1 className="font-headline-xl text-headline-lg-mobile md:text-headline-xl text-on-surface leading-tight">
              See It. Report It. <span className="text-primary">Fix It.</span>
            </h1>

            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
              Report civic issues in your neighborhood with real-time GPS
              tracking, photo evidence, and end-to-end municipal status
              monitoring.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mt-4">
              <button
                onClick={handleReportClick}
                className="bg-primary text-on-primary font-label-md text-label-md px-8 py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-primary-container shadow-level-1 hover:shadow-level-2 transition-all min-h-[48px]"
              >
                <span className="material-symbols-outlined" data-icon="send">
                  send
                </span>
                Report an Issue Now
              </button>
              <button
                onClick={() => navigate("/register")}
                className="bg-surface text-primary border border-outline-variant font-label-md text-label-md px-8 py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-surface-container-low shadow-level-1 transition-all min-h-[48px]"
              >
                <span
                  className="material-symbols-outlined"
                  data-icon="person_add"
                >
                  person_add
                </span>
                Create New Account
              </button>
            </div>

            <div className="flex items-center gap-4 mt-8 pt-6 border-t border-outline-variant/30 w-full">
              <div className="flex -space-x-3">
                <div className="w-10 h-10 rounded-full border-2 border-surface bg-primary-fixed flex items-center justify-center font-bold text-primary text-xs">
                  JD
                </div>
                <div className="w-10 h-10 rounded-full border-2 border-surface bg-secondary-container flex items-center justify-center font-bold text-secondary text-xs">
                  SK
                </div>
                <div className="w-10 h-10 rounded-full border-2 border-surface bg-tertiary-fixed flex items-center justify-center font-bold text-tertiary text-xs">
                  AM
                </div>
              </div>
              <div className="text-sm text-on-surface-variant">
                <p className="font-semibold text-on-surface">
                  Join thousands of active citizens
                </p>
                <p>building better communities</p>
              </div>
            </div>
          </div>

          {/* Hero Illustration */}
          <div className="relative w-full flex justify-center items-center lg:scale-110 z-0 pr-0 h-[480px]">
            <img
              alt="CivicPulse App Mockup"
              className="max-w-full max-h-full object-contain absolute top-0 right-0 !max-w-none !h-full scale-[1.2] origin-top-right transition-transform"
              src={heroImg}
            />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop -mt-16 md:-mt-20 relative z-20 w-full mb-4">
        <div className="bg-surface rounded-2xl shadow-level-2 p-8 border border-surface-container-highest">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-outline-variant/30">
            <div className="flex items-center gap-4 px-4">
              <div className="w-12 h-12 rounded-full bg-error-container/30 flex items-center justify-center text-error">
                <span className="material-symbols-outlined">my_location</span>
              </div>
              <div>
                <div className="font-headline-md text-headline-md text-on-surface">
                  100%
                </div>
                <div className="font-label-sm text-label-sm text-on-surface-variant">
                  GPS Accuracy
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 px-4 pr-0">
              <div className="w-12 h-12 rounded-full bg-tertiary-container/10 flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined">bolt</span>
              </div>
              <div>
                <div className="font-headline-md text-headline-md text-on-surface">
                  &lt; 2 min
                </div>
                <div className="font-label-sm text-label-sm text-on-surface-variant">
                  Filing Time
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 px-4">
              <div className="w-12 h-12 rounded-full bg-secondary-container/30 flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined">monitoring</span>
              </div>
              <div>
                <div className="font-headline-md text-headline-md text-on-surface">
                  Real-time
                </div>
                <div className="font-label-sm text-label-sm text-on-surface-variant">
                  Audit Trail
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 px-4">
              <div className="w-12 h-12 rounded-full bg-primary-container/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">verified_user</span>
              </div>
              <div>
                <div className="font-headline-md text-headline-md text-on-surface">
                  24/7
                </div>
                <div className="font-label-sm text-label-sm text-on-surface-variant">
                  Issue Tracking
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust / Marquee Strip ── */}
      <div className="bg-white border-y border-slate-100 py-6 overflow-hidden">
        <p className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-5">
          Trusted by citizens across municipalities
        </p>

        {/* Single track — 2× copies animated as one for seamless right-to-left loop */}
        <div className="overflow-hidden w-full">
          <div
            className="flex items-center gap-16 w-max"
            style={{ animation: "marquee-ltr 60s linear infinite" }}
          >
            {[...Array(2)].map((_, copyIdx) => (
              <React.Fragment key={copyIdx}>
                {[
                  { domain: "mcgm.gov.in", label: "Mumbai MCGM" },
                  { domain: "mcdonline.nic.in", label: "Delhi MCD" },
                  { domain: "bbmp.gov.in", label: "Bengaluru BBMP" },
                  { domain: "ghmc.gov.in", label: "Hyderabad GHMC" },
                  { domain: "pmc.gov.in", label: "Pune PMC" },
                  {
                    domain: "chennaicorporation.gov.in",
                    label: "Chennai Corp.",
                  },
                  { domain: "kmcgov.in", label: "Kolkata KMC" },
                  { domain: "ahmedabadcity.gov.in", label: "Ahmedabad AMC" },
                  { domain: "jaipurmc.org", label: "Jaipur Nagar Nigam" },
                  { domain: "lmc.up.nic.in", label: "Lucknow LMC" },
                  { domain: "suratmunicipal.org", label: "Surat SMC" },
                  { domain: "nagpurcity.gov.in", label: "Nagpur NMC" },
                  { domain: "pcmcindia.gov.in", label: "Pimpri-Chinchwad" },
                  { domain: "bmc.gov.in", label: "Bhopal BMC" },
                  { domain: "vmc.gov.in", label: "Vadodara VMC" },
                  { domain: "indoreonline.org", label: "Indore IMC" },
                  { domain: "patnaonline.in", label: "Patna Nagar Nigam" },
                  { domain: "chandigarh.gov.in", label: "Chandigarh MC" },
                  { domain: "raipur.gov.in", label: "Raipur Nagar Nigam" },
                  { domain: "cscmc.in", label: "Coimbatore Corp." },
                ].map(({ domain, label }) => (
                  <span
                    key={`${copyIdx}-${label}`}
                    className="inline-flex items-center gap-3 text-base font-semibold text-slate-600 hover:text-blue-600 transition-colors duration-200 cursor-default whitespace-nowrap group"
                  >
                    {/* Logo circle with leaf fallback */}
                    <span className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center shadow-sm group-hover:border-blue-300 transition-colors flex-shrink-0 relative">
                      <img
                        src={`https://icon.horse/icon/${domain}`}
                        alt={label}
                        className="w-7 h-7 object-contain"
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextSibling.style.display = "flex";
                        }}
                      />
                      {/* Leaf fallback icon */}
                      <span
                        className="absolute inset-0 items-center justify-center bg-emerald-50"
                        style={{ display: "none" }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "20px", color: "#16a34a" }}
                        >
                          eco
                        </span>
                      </span>
                    </span>
                    {label}
                  </span>
                ))}

                {/* separator between copies */}
                <span className="inline-flex items-center gap-2 mx-2 flex-shrink-0">
                  <span className="w-1 h-1 rounded-full bg-blue-300 inline-block" />
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-200 inline-block" />
                  <span className="w-1 h-1 rounded-full bg-blue-300 inline-block" />
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>

        <style>{`
          @keyframes marquee-ltr {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}</style>
      </div>

      {/* ── Issues Near You ── */}
      <NearbyIssuesSection />

      {/* Real-Time Civic Analytics & Graphs Section */}
      <CivicAnalyticsSection />

      {/* Supported Civic Categories Section */}
      <section className="py-24 bg-background" id="categories">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
          <div className="text-center mb-16">
            <span className="bg-primary-container/10 text-primary font-label-sm text-label-sm px-4 py-1 rounded-full uppercase tracking-wider">
              Department Matters
            </span>
            <h2 className="font-headline-xl text-headline-lg-mobile md:text-headline-lg mt-4 text-on-surface">
              Supported <span className="text-primary">Civic</span> Categories
            </h2>
            <p className="text-on-surface-variant mt-4 max-w-2xl mx-auto">
              Automated classification forwards reports straight to municipal
              engineering teams.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((cat) => (
              <div
                key={cat.key}
                onClick={() => handleCategorySelect(cat.key)}
                className="bg-surface p-6 rounded-2xl border border-outline-variant/30 hover:shadow-level-2 transition-all cursor-pointer group hover:-translate-y-1"
              >
                <div className="flex justify-between items-start mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${cat.bgClass}`}
                  >
                    <span className="material-symbols-outlined">
                      {cat.icon}
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-outline-variant group-hover:text-primary transition-colors">
                    chevron_right
                  </span>
                </div>
                <h3 className="font-headline-sm text-on-surface mb-2">
                  {cat.title}
                </h3>
                <p className="text-label-sm text-on-surface-variant">
                  {cat.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How CivicReport Works Section */}
      <section className="py-24 bg-surface-container-low" id="how-it-works">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
          <div className="text-center mb-16">
            <span className="bg-primary-container/10 text-primary font-label-sm text-label-sm px-4 py-1 rounded-full uppercase tracking-wider">
              Built on a simple process
            </span>
            <h2 className="font-headline-xl text-headline-lg-mobile md:text-headline-lg mt-4 text-on-surface">
              How CivicPulse Works
            </h2>
            <p className="text-on-surface-variant mt-4">
              Four seamless steps from detection to official resolution
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {/* Process Card 1 */}
            <div className="relative flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface shadow-level-1 flex items-center justify-center text-primary mb-6 z-10">
                <span className="material-symbols-outlined text-3xl">
                  photo_camera
                </span>
              </div>
              <span className="text-primary font-label-sm text-[10px] uppercase tracking-widest mb-2">
                Phase 01
              </span>
              <h3 className="font-headline-sm text-on-surface mb-2">
                Capture Issue
              </h3>
              <p className="text-body-md text-on-surface-variant">
                Take a photo, add details and mark the location
              </p>
              <div className="hidden md:block absolute top-8 left-[calc(50%+40px)] w-[calc(100%-80px)] h-px border-t-2 border-dashed border-outline-variant/50"></div>
            </div>

            {/* Process Card 2 */}
            <div className="relative flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface shadow-level-1 flex items-center justify-center text-error mb-6 z-10">
                <span className="material-symbols-outlined text-3xl">
                  location_on
                </span>
              </div>
              <span className="text-primary font-label-sm text-[10px] uppercase tracking-widest mb-2">
                Phase 02
              </span>
              <h3 className="font-headline-sm text-on-surface mb-2">
                Geotag Location
              </h3>
              <p className="text-body-md text-on-surface-variant">
                Precise GPS coordinates automatically tag the map
              </p>
              <div className="hidden md:block absolute top-8 left-[calc(50%+40px)] w-[calc(100%-80px)] h-px border-t-2 border-dashed border-outline-variant/50"></div>
            </div>

            {/* Process Card 3 */}
            <div className="relative flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface shadow-level-1 flex items-center justify-center text-secondary mb-6 z-10">
                <span className="material-symbols-outlined text-3xl">send</span>
              </div>
              <span className="text-primary font-label-sm text-[10px] uppercase tracking-widest mb-2">
                Phase 03
              </span>
              <h3 className="font-headline-sm text-on-surface mb-2">
                Track Progress
              </h3>
              <p className="text-body-md text-on-surface-variant">
                Real-time status updates from municipal teams
              </p>
              <div className="hidden md:block absolute top-8 left-[calc(50%+40px)] w-[calc(100%-80px)] h-px border-t-2 border-dashed border-outline-variant/50"></div>
            </div>

            {/* Process Card 4 */}
            <div className="relative flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface shadow-level-1 flex items-center justify-center text-primary mb-6 z-10">
                <span className="material-symbols-outlined text-3xl">
                  check_circle
                </span>
              </div>
              <span className="text-primary font-label-sm text-[10px] uppercase tracking-widest mb-2">
                Phase 04
              </span>
              <h3 className="font-headline-sm text-on-surface mb-2">
                Rapid Resolution
              </h3>
              <p className="text-body-md text-on-surface-variant">
                Issues get resolved faster with verified closure
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Transforming Municipal Governance Banner */}
      <section className="py-12 md:py-16">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
          <div className="relative rounded-3xl overflow-hidden border border-outline-variant/30 shadow-[0px_12px_40px_rgba(15,23,42,0.08)] min-h-[300px] md:min-h-[340px] flex items-center bg-surface-container-lowest">
            {/* Full Background Image */}
            <img
              alt="Smart City Background"
              className="absolute inset-0 w-full h-full object-cover object-center lg:object-right z-0"
              src={bannerImg}
            />

            {/* Gradient & Frosted Overlay for Maximum Readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/85 via-50% to-white/40 lg:to-transparent z-0"></div>

            {/* Content Area */}
            <div className="relative z-10 p-6 md:p-8 lg:p-10 max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 font-label-sm text-xs px-3.5 py-1 rounded-full uppercase tracking-wider font-bold mb-4 backdrop-blur-xs">
                <span className="material-symbols-outlined text-sm">
                  auto_awesome
                </span>
                Stronger Communities, Greater Possibilities
              </div>

              <h2 className="font-headline-xl text-headline-lg-mobile md:text-headline-xl text-on-surface font-extrabold leading-tight tracking-tight">
                Transforming{" "}
                <span className="bg-gradient-to-r from-primary via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Municipal Governance
                </span>
              </h2>

              <p className="text-body-lg text-on-surface-variant mt-3 mb-5 leading-relaxed font-medium">
                Experience next-generation civic tech. Log neighborhood hazards
                in real-time, monitor verification milestones, and build
                cleaner, safer cities together.
              </p>

              {/* Feature Highlights Pills */}
              <div className="flex flex-wrap gap-3 mb-5">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-lg bg-white/90 text-on-surface text-xs font-semibold border border-outline-variant/40 shadow-xs backdrop-blur-xs">
                  <span className="material-symbols-outlined text-primary text-sm">
                    bolt
                  </span>
                  Instant Department Routing
                </span>
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-lg bg-white/90 text-on-surface text-xs font-semibold border border-outline-variant/40 shadow-xs backdrop-blur-xs">
                  <span className="material-symbols-outlined text-secondary text-sm">
                    verified
                  </span>
                  Verified Resolution
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
                <button
                  onClick={handleReportClick}
                  className="bg-primary text-on-primary font-label-md text-label-md px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-primary-container shadow-level-1 hover:shadow-level-2 hover:-translate-y-0.5 transition-all group"
                >
                  <span>Launch Citizen Portal</span>
                  <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </button>

                <button
                  onClick={() => navigate("/register")}
                  className="bg-white/90 backdrop-blur-xs text-on-surface font-label-md text-label-md px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-white border border-outline-variant/40 transition-colors shadow-xs"
                >
                  <span className="material-symbols-outlined text-primary text-base">
                    person_add
                  </span>
                  <span>Create New Account</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;
