import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { complaintService } from '../services/complaintService';

// Fix Leaflet's default icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom icons based on priority/status
const createMarkerIcon = (priority, status) => {
  let color = '#3B82F6'; // default blue
  
  if (status === 'RESOLVED' || status === 'VERIFIED') color = '#10B981'; // green
  else if (priority === 'CRITICAL') color = '#EF4444'; // red
  else if (priority === 'HIGH') color = '#F97316'; // orange
  else if (priority === 'MEDIUM') color = '#EAB308'; // yellow
  
  const markerHtml = `
    <div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>
  `;
  
  return L.divIcon({
    html: markerHtml,
    className: 'custom-leaflet-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

const CivicMapPage = () => {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  
  const delhiCenter = [28.6139, 77.2090];
  const zoomLevel = 11;

  useEffect(() => {
    fetchMapData();
  }, [filter]);

  const fetchMapData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter !== 'ALL') params.status = filter;
      const res = await complaintService.getMapData(params);
      if (res.success) {
        setPoints(res.points);
      }
    } catch (error) {
      console.error('Error fetching map data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl h-[calc(100vh-100px)] flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Live Civic Map</h1>
          <p className="text-slate-600 mt-1">Real-time visualization of city issues</p>
        </div>
        <div className="flex gap-2">
          <select 
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="ALL">All Issues</option>
            <option value="SUBMITTED">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
      </div>
      
      <div className="flex-1 bg-white p-4 rounded-xl shadow border border-slate-200 relative flex flex-col">
        {loading && (
          <div className="absolute inset-0 bg-white/50 z-[1000] flex items-center justify-center rounded-xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}
        <div className="flex-1 w-full rounded-lg overflow-hidden min-h-[400px]">
          <MapContainer 
            center={delhiCenter} 
            zoom={zoomLevel} 
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {points.map((point) => (
              <Marker 
                key={point.id}
                position={[point.lat, point.lng]}
                icon={createMarkerIcon(point.priority, point.status)}
              >
                <Popup>
                  <div className="p-2 min-w-[200px]">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold uppercase px-2 py-1 bg-slate-100 rounded text-slate-600">{point.category}</span>
                      <span className="text-xs font-bold text-slate-400">#{point.complaintId}</span>
                    </div>
                    <p className="text-sm text-slate-700 mb-2">{point.description}</p>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold">{point.status}</span>
                      <span className="text-slate-500">{new Date(point.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
      
      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 items-center text-sm text-slate-600">
        <span className="font-semibold text-slate-800">Legend:</span>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div> Critical</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500"></div> High</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-500"></div> Medium</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Low</div>
        <div className="flex items-center gap-2 ml-4"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Resolved/Verified</div>
      </div>
    </div>
  );
};

export default CivicMapPage;
