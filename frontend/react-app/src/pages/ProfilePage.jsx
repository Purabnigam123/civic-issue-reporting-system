import React, { useState, useEffect, useRef } from 'react';
import DashboardNavbar from '../components/layout/DashboardNavbar';
import MobileBottomNav from '../components/layout/MobileBottomNav';
import { useAuth } from '../context/AuthContext';
import { complaintService } from '../services/complaintService';

const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const fileInputRef = useRef(null);

  // Editable fields
  const [name, setName] = useState(user?.name || 'Demo Citizen');
  const [email, setEmail] = useState(user?.email || 'citizen@civic.local');
  const [phone, setPhone] = useState(user?.phone || '+91 9876543210');
  const [avatar, setAvatar] = useState(user?.avatar || '');

  useEffect(() => {
    if (user) {
      setName(user.name || 'Demo Citizen');
      setEmail(user.email || 'citizen@civic.local');
      setPhone(user.phone || '+91 9876543210');
      setAvatar(user.avatar || '');
    }
  }, [user]);

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        const data = await complaintService.getMyComplaints();
        setComplaints(data.complaints || []);
      } catch (err) {
        console.error('Profile complaints error:', err);
      }
    };

    fetchComplaints();
  }, []);

  const resolvedCount = complaints.filter((c) => c.status === 'RESOLVED').length;

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleImageChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Please select an image smaller than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const newAvatar = reader.result;
      setAvatar(newAvatar);
      if (updateUser) {
        updateUser({ avatar: newAvatar });
      }
      showToast('Display picture updated successfully!');
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setAvatar('');
    if (updateUser) {
      updateUser({ avatar: '' });
    }
    showToast('Display picture removed.');
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (updateUser) {
      updateUser({ name, email, phone, avatar });
    }
    setIsEditing(false);
    showToast('Profile information updated successfully!');
  };

  const formatMemberSince = (dateStr) => {
    if (!dateStr) return 'Member since Oct 2023';
    const date = new Date(dateStr);
    return `Member since ${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
  };

  return (
    <div className="bg-background pt-20 pb-24 md:pb-12 min-h-screen">
      <DashboardNavbar />

      <main className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop mt-8">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-20 right-6 z-50 p-4 bg-primary text-on-primary rounded-xl shadow-level-2 flex items-center gap-3 animate-bounce">
            <span className="material-symbols-outlined">check_circle</span>
            <span className="font-label-md">{toastMessage}</span>
          </div>
        )}

        <div className="mb-8">
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface font-bold">
            Profile Settings
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">
            Manage your personal information and preferences.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          {/* Left Column: Profile Card & Quick Actions */}
          <div className="lg:col-span-4 space-y-6">
            {/* Profile Summary Card */}
            <div className="bg-surface-container-lowest rounded-xl elevation-1 p-6 flex flex-col items-center text-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/*"
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative mb-4 group cursor-pointer"
                title="Click to change display picture"
              >
                <div className="w-32 h-32 rounded-full elevation-1 border-4 border-surface-container-lowest bg-primary-fixed flex items-center justify-center text-primary text-4xl font-extrabold shadow-sm overflow-hidden">
                  {avatar ? (
                    <img src={avatar} alt={name || 'User Avatar'} className="w-full h-full object-cover" />
                  ) : (
                    name ? name.charAt(0).toUpperCase() : 'C'
                  )}
                </div>
                <div className="absolute inset-0 bg-black/40 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="material-symbols-outlined text-white text-3xl">photo_camera</span>
                  <span className="text-white text-[11px] font-semibold mt-0.5">Change Photo</span>
                </div>
                <button
                  type="button"
                  aria-label="Upload photo"
                  className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-primary text-on-primary shadow-md flex items-center justify-center border-2 border-white hover:bg-primary-container transition-transform group-hover:scale-110"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                </button>
              </div>

              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">{name}</h3>
              <p className="font-label-md text-label-md text-on-surface-variant mt-1 flex items-center justify-center gap-1 font-semibold text-primary">
                <span className="material-symbols-outlined text-sm">verified</span>
                Verified Resident
              </p>

              {/* Display Picture Control Actions */}
              <div className="flex items-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-1.5 bg-primary-fixed text-on-primary-fixed-variant text-xs font-semibold rounded-lg hover:bg-primary-fixed-dim transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">photo_camera</span>
                  Change Photo
                </button>
                {avatar && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="px-3 py-1.5 border border-outline-variant text-error text-xs font-semibold rounded-lg hover:bg-error-container/20 transition-colors flex items-center gap-1 text-xs"
                    title="Remove custom photo"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    Remove
                  </button>
                )}
              </div>

              <p className="font-label-sm text-label-sm text-outline mt-3">{formatMemberSince(user?.createdAt)}</p>
            </div>

            {/* Quick Stats / Badges */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface-container-lowest rounded-xl elevation-1 p-4 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center mb-2">
                  <span className="material-symbols-outlined text-on-secondary-container">task_alt</span>
                </div>
                <span className="font-headline-sm text-headline-sm text-on-surface font-bold">{resolvedCount}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Reports
                  <br />
                  Resolved
                </span>
              </div>

              <div className="bg-surface-container-lowest rounded-xl elevation-1 p-4 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center mb-2">
                  <span className="material-symbols-outlined text-on-primary-container">local_police</span>
                </div>
                <span className="font-headline-sm text-headline-sm text-on-surface font-bold">Top</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Community
                  <br />
                  Contributor
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Settings Forms */}
          <div className="lg:col-span-8 space-y-6">
            {/* Personal Information */}
            <section className="bg-surface-container-lowest rounded-xl elevation-1 p-6 md:p-8">
              <div className="flex justify-between items-center mb-6 border-b border-surface-variant pb-4">
                <h4 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2 font-bold">
                  <span className="material-symbols-outlined text-primary">person</span>
                  Personal Information
                </h4>
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="font-label-md text-label-md text-primary hover:text-primary-container transition-colors font-semibold"
                >
                  {isEditing ? 'Cancel' : 'Edit'}
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant font-semibold">Full Name</label>
                  <input
                    className={`w-full h-12 px-4 rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary bg-transparent font-body-md text-body-md text-on-surface transition-colors ${
                      !isEditing ? 'opacity-70 bg-surface-container-low cursor-not-allowed' : ''
                    }`}
                    disabled={!isEditing}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant font-semibold">
                    Email Address
                  </label>
                  <input
                    className={`w-full h-12 px-4 rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary bg-transparent font-body-md text-body-md text-on-surface transition-colors ${
                      !isEditing ? 'opacity-70 bg-surface-container-low cursor-not-allowed' : ''
                    }`}
                    disabled={!isEditing}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="font-label-sm text-label-sm text-on-surface-variant font-semibold">
                    Phone Number
                  </label>
                  <input
                    className={`w-full h-12 px-4 rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary bg-transparent font-body-md text-body-md text-on-surface transition-colors ${
                      !isEditing ? 'opacity-70 bg-surface-container-low cursor-not-allowed' : ''
                    }`}
                    disabled={!isEditing}
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                {isEditing && (
                  <div className="md:col-span-2 flex justify-end">
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-primary text-on-primary rounded-lg font-label-md hover:bg-primary-container shadow-sm transition-colors"
                    >
                      Save Changes
                    </button>
                  </div>
                )}
              </form>
            </section>

            {/* Notification Preferences */}
            <section className="bg-surface-container-lowest rounded-xl elevation-1 p-6 md:p-8">
              <div className="mb-6 border-b border-surface-variant pb-4">
                <h4 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2 font-bold">
                  <span className="material-symbols-outlined text-primary">notifications_active</span>
                  Notification Preferences
                </h4>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg">
                  <div>
                    <p className="font-body-md text-body-md font-medium text-on-surface">Email Alerts</p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">
                      Receive updates about your reports via email.
                    </p>
                  </div>
                  {/* Toggle */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailAlerts}
                      onChange={(e) => {
                        setEmailAlerts(e.target.checked);
                        showToast(`Email alerts ${e.target.checked ? 'enabled' : 'disabled'}`);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg">
                  <div>
                    <p className="font-body-md text-body-md font-medium text-on-surface">SMS Notifications</p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">
                      Get instant text alerts for urgent municipal updates.
                    </p>
                  </div>
                  {/* Toggle */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smsAlerts}
                      onChange={(e) => {
                        setSmsAlerts(e.target.checked);
                        showToast(`SMS notifications ${e.target.checked ? 'enabled' : 'disabled'}`);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
            </section>

            {/* Account Security */}
            <section className="bg-surface-container-lowest rounded-xl elevation-1 p-6 md:p-8">
              <div className="mb-6 border-b border-surface-variant pb-4">
                <h4 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2 font-bold">
                  <span className="material-symbols-outlined text-primary">security</span>
                  Account Security
                </h4>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-outline-variant rounded-lg">
                  <div>
                    <p className="font-body-md text-body-md font-medium text-on-surface">Password</p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">Last changed recently</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => showToast('Password reset link dispatched to your email!')}
                    className="px-6 py-2 border border-primary text-primary rounded-lg font-label-md text-label-md hover:bg-primary/5 transition-colors font-semibold"
                  >
                    Change Password
                  </button>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-outline-variant rounded-lg">
                  <div>
                    <p className="font-body-md text-body-md font-medium text-on-surface">
                      Two-Factor Authentication (2FA)
                    </p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">
                      Add an extra layer of security to your account.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => showToast('2FA configuration modal opened!')}
                    className="px-6 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors shadow-sm font-semibold"
                  >
                    Enable 2FA
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default ProfilePage;
