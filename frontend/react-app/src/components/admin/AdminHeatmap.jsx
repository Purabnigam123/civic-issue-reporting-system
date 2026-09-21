import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { adminService } from '../../services/adminService';
import StatusBadge from '../ui/StatusBadge';

// Fix standard Leaflet default icon paths if needed
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Delhi NCT center coordinates and default district locations
const DELHI_CENTER = [28.6139, 77.2090];
const DELHI_DISTRICT_COORDS = {
  all: [28.6139, 77.2090, 11],
  central_delhi: [28.6453, 77.2183, 13],
  central_north_delhi: [28.6942, 77.1685, 13],
  east_delhi: [28.6280, 77.3000, 13],
  new_delhi: [28.6000, 77.2000, 13],
  north_delhi: [28.7300, 77.1900, 13],
  north_east_delhi: [28.7100, 77.2700, 13],
  north_west_delhi: [28.7100, 77.0800, 12],
  old_delhi: [28.6562, 77.2300, 14],
  outer_north_delhi: [28.8200, 77.0900, 12],
  south_delhi: [28.5200, 77.2100, 13],
  south_east_delhi: [28.5500, 77.2700, 13],
  south_west_delhi: [28.5800, 77.0300, 12],
  west_delhi: [28.6400, 77.1000, 13],
};

// Custom colored pin icons based on priority & status
const createPinIcon = (priority, isEscalated) => {
  let pinColor = '#0058be'; // default primary
  let glowColor = 'rgba(0, 88, 190, 0.35)';

  if (isEscalated || priority === 'CRITICAL') {
    pinColor = '#ba1a1a'; // error
    glowColor = 'rgba(186, 26, 26, 0.4)';
  } else if (priority === 'HIGH') {
    pinColor = '#825100'; // tertiary / amber
    glowColor = 'rgba(130, 81, 0, 0.35)';
  } else if (priority === 'LOW') {
    pinColor = '#006c49'; // secondary / green
    glowColor = 'rgba(0, 108, 73, 0.35)';
  }

  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background: ${glowColor}; animation: pulse 2s infinite;"></div>
        <div style="position: relative; width: 22px; height: 22px; background: ${pinColor}; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid #ffffff; box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25); display: flex; align-items: center; justify-content: center;">
          <div style="width: 7px; height: 7px; background: #ffffff; border-radius: 50%; transform: rotate(45deg);"></div>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 28],
    popupAnchor: [0, -28],
  });
};

// HeatLayer controller sub-component
const HeatmapLayer = ({ points, radius, blur, maxZoom }) => {
  const map = useMap();
  const heatLayerRef = useRef(null);

  useEffect(() => {
    if (!map) return;

    // Convert points to [lat, lng, weight]
    const heatData = points.map((p) => [p.lat, p.lng, p.weight || 0.6]);

    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    if (heatData.length > 0 && typeof L.heatLayer === 'function') {
      const heat = L.heatLayer(heatData, {
        radius: radius || 25,
        blur: blur || 15,
        maxZoom: maxZoom || 15,
        max: 1.0,
        minOpacity: 0.35,
        gradient: {
          0.15: '#0058be',  // Civic Blue
          0.35: '#00a6f4',  // Light Blue
          0.55: '#006c49',  // Emerald Green
          0.75: '#825100',  // Amber Orange
          0.95: '#ba1a1a',  // Urgent Crimson Red
        },
      });

      heat.addTo(map);
      heatLayerRef.current = heat;
    }

    return () => {
      if (heatLayerRef.current && map) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    };
  }, [map, points, radius, blur, maxZoom]);

  return null;
};

// Recenter map controller sub-component
const MapRecenter = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (map && center) {
      map.flyTo(center, zoom || 12, { duration: 1.2 });
    }
  }, [map, center, zoom]);
  return null;
};

const AdminHeatmap = () => {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('heatmap'); // 'heatmap' | 'markers' | 'both'
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('all');
  const [radius, setRadius] = useState(25);
  const [mapCenter, setMapCenter] = useState(DELHI_CENTER);
  const [mapZoom, setMapZoom] = useState(11);

  const fetchHeatmapData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedCategory) params.category = selectedCategory;
      if (selectedStatus) params.status = selectedStatus;
      if (selectedPriority) params.priority = selectedPriority;
      if (selectedDistrict && selectedDistrict !== 'all') params.district_id = selectedDistrict;

      const data = await adminService.getHeatmapData(params);
      if (data && data.points) {
        setPoints(data.points);
      }
    } catch (err) {
      console.error('Failed to load heatmap data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeatmapData();
  }, [selectedCategory, selectedStatus, selectedPriority, selectedDistrict]);

  const handleDistrictChange = (districtKey) => {
    setSelectedDistrict(districtKey);
    const coords = DELHI_DISTRICT_COORDS[districtKey] || DELHI_DISTRICT_COORDS.all;
    setMapCenter([coords[0], coords[1]]);
    setMapZoom(coords[2]);
  };

  const categories = [
    { value: '', label: 'All Categories' },
    { value: 'pothole', label: 'Pothole & Road Damage' },
    { value: 'garbage', label: 'Garbage & Solid Waste' },
    { value: 'water_issue', label: 'Water Leak / Supply' },
    { value: 'drainage', label: 'Drainage & Sewage' },
    { value: 'broken_streetlight', label: 'Broken Streetlight' },
    { value: 'public_property', label: 'Public Property' },
  ];

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 civic-glow p-5 space-y-4">
      {/* Header & Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-outline-variant/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">local_fire_department</span>
            <h3 className="font-extrabold text-base text-on-surface tracking-tight">
              Delhi NCT Incident Density & Heatmap
            </h3>
          </div>
          <p className="text-xs text-on-surface-variant font-medium mt-0.5">
            Real-time geospatial concentration of citizen reports and municipal distress hotspots
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant/20">
          <button
            type="button"
            onClick={() => setViewMode('heatmap')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              viewMode === 'heatmap'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-sm">grain</span>
            Heatmap
          </button>
          <button
            type="button"
            onClick={() => setViewMode('markers')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              viewMode === 'markers'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-sm">location_on</span>
            Incidents
          </button>
          <button
            type="button"
            onClick={() => setViewMode('both')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              viewMode === 'both'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-sm">layers</span>
            Combined
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Category */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface font-semibold outline-none focus:border-primary"
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          {/* Status */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface font-semibold outline-none focus:border-primary"
          >
            <option value="">All Statuses</option>
            <option value="SUBMITTED">SUBMITTED (Unassigned)</option>
            <option value="ASSIGNED">ASSIGNED</option>
            <option value="IN_PROGRESS">IN PROGRESS</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="ESCALATED">ESCALATED (Breached SLA)</option>
          </select>

          {/* Priority */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface font-semibold outline-none focus:border-primary"
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">CRITICAL Priority</option>
            <option value="HIGH">HIGH Priority</option>
            <option value="MEDIUM">MEDIUM Priority</option>
            <option value="LOW">LOW Priority</option>
          </select>

          {/* District Quick Select */}
          <select
            value={selectedDistrict}
            onChange={(e) => handleDistrictChange(e.target.value)}
            className="px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface font-semibold outline-none focus:border-primary"
          >
            <option value="all">📍 All 13 Delhi Districts</option>
            <option value="central_delhi">Central Delhi (Patel Nagar, Karol Bagh)</option>
            <option value="central_north_delhi">Central North Delhi (Shakur Basti, Model Town)</option>
            <option value="east_delhi">East Delhi (Gandhi Nagar, Patparganj)</option>
            <option value="new_delhi">New Delhi (Connaught Place, Cantt)</option>
            <option value="north_delhi">North Delhi (Burari, Adarsh Nagar)</option>
            <option value="north_east_delhi">North East Delhi (Yamuna Vihar, Shahdara)</option>
            <option value="north_west_delhi">North West Delhi (Kirari, Nangloi, Rohini)</option>
            <option value="old_delhi">Old Delhi (Sadar Bazar, Chandni Chowk)</option>
            <option value="outer_north_delhi">Outer North Delhi (Mundka, Narela, Bawana)</option>
            <option value="south_delhi">South Delhi (Chhatarpur, Mehrauli, Saket)</option>
            <option value="south_east_delhi">South East Delhi (Jangpura, Kalkaji, Badarpur)</option>
            <option value="south_west_delhi">South West Delhi (Dwarka, Najafgarh)</option>
            <option value="west_delhi">West Delhi (Vikaspuri, Janakpuri, Rajouri Garden)</option>
          </select>
        </div>

        {/* Heat Radius Slider */}
        {(viewMode === 'heatmap' || viewMode === 'both') && (
          <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-xl border border-outline-variant/20">
            <span className="text-[11px] font-bold text-on-surface-variant">Radius:</span>
            <input
              type="range"
              min="15"
              max="45"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-20 accent-primary cursor-pointer"
            />
            <span className="text-[10px] font-mono font-bold text-primary">{radius}px</span>
          </div>
        )}
      </div>

      {/* Map Display Container */}
      <div className="relative rounded-xl overflow-hidden border border-outline-variant/30 shadow-inner h-[440px] z-0">
        {loading && (
          <div className="absolute inset-0 bg-surface-container-lowest/70 backdrop-blur-xs z-10 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-on-surface mt-3">Rendering geospatial heatmap...</p>
          </div>
        )}

        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          scrollWheelZoom={false}
          className="w-full h-full"
          style={{ background: '#f8fafc' }}
        >
          <MapRecenter center={mapCenter} zoom={mapZoom} />

          {/* Clean CartoDB Positron light map tiles */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />

          {/* Heatmap Layer */}
          {(viewMode === 'heatmap' || viewMode === 'both') && (
            <HeatmapLayer points={points} radius={radius} blur={16} maxZoom={16} />
          )}

          {/* Marker Pins */}
          {(viewMode === 'markers' || viewMode === 'both') &&
            points.map((p) => (
              <Marker
                key={p.id || p.complaintId}
                position={[p.lat, p.lng]}
                icon={createPinIcon(p.priority, p.isEscalated)}
              >
                <Popup className="civic-map-popup">
                  <div className="p-1 space-y-2 text-xs max-w-[220px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-primary text-[11px]">
                        #{p.complaintId}
                      </span>
                      <StatusBadge status={p.status} />
                    </div>

                    <div>
                      <h4 className="font-bold text-on-surface capitalize text-[13px] leading-tight">
                        {p.category?.replace('_', ' ')}
                      </h4>
                      <p className="text-outline text-[11px] truncate mt-0.5">{p.address}</p>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-outline-variant/20 text-[10px]">
                      <span className="font-bold text-on-surface-variant uppercase">
                        {p.district_name || p.district_id || 'Delhi'}
                      </span>
                      <span className="text-primary font-bold">
                        ▲ {p.upvotes || 0} upvotes
                      </span>
                    </div>

                    {p.isEscalated && (
                      <div className="px-2 py-0.5 rounded bg-error-container text-on-error-container text-[10px] font-bold text-center">
                        ⚠️ SLA BREACH ESCALATED
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
        </MapContainer>

        {/* Floating Map Legend & Stats Overlay */}
        <div className="absolute bottom-3 left-3 z-10 bg-surface-container-lowest/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-outline-variant/30 shadow-md flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
            <span className="font-bold text-on-surface">{points.length} Geotagged Issues</span>
          </div>

          <div className="h-3 w-px bg-outline-variant/40"></div>

          {/* Heat gradient legend */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-outline">Low Density</span>
            <div className="w-20 h-2 rounded-full bg-gradient-to-r from-[#0058be] via-[#006c49] via-[#825100] to-[#ba1a1a]"></div>
            <span className="text-[10px] font-bold text-error">High Hotspot</span>
          </div>
        </div>

        {/* Reset Delhi Bounds Button */}
        <button
          type="button"
          onClick={() => handleDistrictChange('all')}
          className="absolute top-3 right-3 z-10 bg-surface-container-lowest/95 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-outline-variant/30 shadow-sm text-xs font-bold text-on-surface hover:text-primary hover:bg-surface-container-low transition-all flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-base">center_focus_strong</span>
          Reset Delhi View
        </button>
      </div>
    </div>
  );
};

export default AdminHeatmap;
