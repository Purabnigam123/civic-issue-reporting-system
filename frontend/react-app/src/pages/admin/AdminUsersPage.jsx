import React, { useState, useEffect } from 'react';
import AdminSidebar from '../../components/admin/AdminSidebar';
import { adminService } from '../../services/adminService';

const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [showZonalModal, setShowZonalModal] = useState(false);
  const [zonalForm, setZonalForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: 'Admin@123',
    district_id: 'central_delhi',
  });
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await adminService.getUsers({
        page,
        limit: 15,
        ...(roleFilter && { role: roleFilter }),
        ...(search && { search }),
      });
      if (data && data.users) {
        setUsers(data.users);
        setTotalPages(data.pages || 1);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleCreateZonalAdmin = async (e) => {
    e.preventDefault();
    try {
      setCreatingAdmin(true);
      await adminService.createZonalAdmin(zonalForm);
      setShowZonalModal(false);
      setZonalForm({
        name: '',
        email: '',
        phone: '',
        password: 'Admin@123',
        district_id: 'central_delhi',
      });
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create Zonal Admin account');
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleBan = async (userId) => {
    const reason = prompt('Reason for banning user account:');
    if (!reason) return;

    try {
      await adminService.banUser(userId, reason);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to ban user');
    }
  };

  const handleUnban = async (userId) => {
    try {
      await adminService.unbanUser(userId);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to unban user');
    }
  };

  const DELHI_DISTRICTS = [
    { id: 'central_delhi', name: 'Central Delhi (Patel Nagar, Karol Bagh)' },
    { id: 'central_north_delhi', name: 'Central North Delhi (Shakur Basti, Model Town)' },
    { id: 'east_delhi', name: 'East Delhi (Gandhi Nagar, Vishwas Nagar, Patparganj)' },
    { id: 'new_delhi', name: 'New Delhi (New Delhi, Delhi Cantt)' },
    { id: 'north_delhi', name: 'North Delhi (Burari, Adarsh Nagar, Badli)' },
    { id: 'north_east_delhi', name: 'North East Delhi (Karawal Nagar, Yamuna Vihar, Shahdara)' },
    { id: 'north_west_delhi', name: 'North West Delhi (Kirari, Nangloi Jat, Rohini)' },
    { id: 'old_delhi', name: 'Old Delhi (Sadar Bazar, Chandni Chowk)' },
    { id: 'outer_north_delhi', name: 'Outer North Delhi (Mundka, Narela, Bawana)' },
    { id: 'south_delhi', name: 'South Delhi (Chhatarpur, Malviya Nagar, Mehrauli)' },
    { id: 'south_east_delhi', name: 'South East Delhi (Jangpura, Kalkaji, Badarpur)' },
    { id: 'south_west_delhi', name: 'South West Delhi (Najafgarh, Dwarka, Bijwasan)' },
    { id: 'west_delhi', name: 'West Delhi (Vikaspuri, Janakpuri, Rajouri Garden)' },
  ];

  return (
    <div className="flex min-h-screen bg-background text-on-background font-body-md antialiased">
      <AdminSidebar />

      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-h-screen">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 bg-surface-container-highest text-on-primary-fixed-variant px-3 py-1 rounded-full font-label-sm text-label-sm mb-2">
              <span className="material-symbols-outlined text-primary text-sm">group</span>
              <span>Personnel & Citizen Governance</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">
              Citizen & Personnel Directory
            </h1>
            <p className="text-xs md:text-sm text-on-surface-variant mt-0.5">
              Manage citizens, field workers, and zonal administrators across the municipality
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowZonalModal(true)}
            className="px-4 py-2.5 bg-primary hover:bg-primary-container text-on-primary rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
          >
            <span className="material-symbols-outlined text-base">admin_panel_settings</span>
            Create Zonal Admin
          </button>
        </div>

        {/* Filters */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 mb-6 flex flex-wrap gap-3 items-center justify-between civic-glow">
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[240px] flex gap-2">
            <input
              type="text"
              placeholder="Search by name, email, phone, or worker ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-xs text-on-surface placeholder:text-outline focus:border-primary outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary-container shadow-sm"
            >
              Search
            </button>
          </form>

          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-xs text-on-surface outline-none font-semibold"
          >
            <option value="">All Roles</option>
            <option value="CITIZEN">CITIZEN</option>
            <option value="WORKER">WORKER</option>
            <option value="ZONAL_ADMIN">ZONAL ADMIN</option>
            <option value="SUPER_ADMIN">SUPER ADMIN</option>
          </select>
        </div>

        {/* Users Table */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 overflow-hidden civic-glow">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-on-surface-variant mt-3 font-semibold">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16 text-on-surface-variant text-sm">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-outline-variant/30 bg-surface-container-low text-on-surface-variant font-bold uppercase">
                    <th className="py-3.5 px-4">User</th>
                    <th className="py-3.5 px-4">Email / Phone</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">District / Zone</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Moderation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-surface-container-low/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-fixed text-primary font-bold flex items-center justify-center text-xs shrink-0 border border-primary/20">
                            {(u.name || 'U')[0].toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-on-surface block">{u.name}</span>
                            {u.worker_id && <span className="text-[10px] text-primary font-mono font-semibold">{u.worker_id}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-on-surface">
                        <div className="font-medium">{u.email}</div>
                        <div className="text-[11px] text-on-surface-variant">{u.phone || 'No phone'}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          u.role === 'SUPER_ADMIN' ? 'bg-primary-fixed text-on-primary-fixed-variant' :
                          u.role === 'ZONAL_ADMIN' ? 'bg-surface-container-highest text-primary' :
                          u.role === 'WORKER' ? 'bg-tertiary-fixed text-tertiary' : 'bg-surface-container-high text-on-surface-variant'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 capitalize text-on-surface-variant font-medium">
                        {u.district_id?.replace('_', ' ') || 'All Delhi'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          u.status === 'BANNED' ? 'bg-error-container text-error' : 'bg-secondary-fixed/40 text-secondary'
                        }`}>
                          {u.status || 'ACTIVE'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {u.role !== 'SUPER_ADMIN' && (
                          u.status === 'BANNED' ? (
                            <button
                              type="button"
                              onClick={() => handleUnban(u.id)}
                              className="px-3 py-1 bg-secondary-fixed/40 hover:bg-secondary-fixed text-secondary rounded-lg text-xs font-bold shadow-sm"
                            >
                              Unban
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleBan(u.id)}
                              className="px-3 py-1 bg-error-container/50 hover:bg-error-container text-error rounded-lg text-xs font-bold shadow-sm"
                            >
                              Ban User
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="p-4 border-t border-outline-variant/20 flex justify-between items-center text-xs text-on-surface-variant">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  className="px-3 py-1 bg-surface-container-low hover:bg-surface-container text-on-surface rounded-lg disabled:opacity-40 font-semibold"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  className="px-3 py-1 bg-surface-container-low hover:bg-surface-container text-on-surface rounded-lg disabled:opacity-40 font-semibold"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal: Create Zonal Admin */}
        {showZonalModal && (
          <div className="fixed inset-0 bg-scrim/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-md p-6 text-on-surface shadow-2xl civic-glow animate-fade-in">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-outline-variant/20">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">admin_panel_settings</span>
                  <h3 className="text-base font-extrabold text-on-surface">Create Zonal Admin Account</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowZonalModal(false)}
                  className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-low font-bold transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <form onSubmit={handleCreateZonalAdmin} className="space-y-4 text-xs">
                <div>
                  <label className="block text-outline font-extrabold uppercase mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Officer Rajesh Sharma"
                    value={zonalForm.name}
                    onChange={(e) => setZonalForm({ ...zonalForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-outline font-extrabold uppercase mb-1">Official Email</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. zonal.central@delhi.gov.in"
                    value={zonalForm.email}
                    onChange={(e) => setZonalForm({ ...zonalForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-outline font-extrabold uppercase mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. 9811000001"
                    value={zonalForm.phone}
                    onChange={(e) => setZonalForm({ ...zonalForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-outline font-extrabold uppercase mb-1">Assigned Delhi District</label>
                  <select
                    value={zonalForm.district_id}
                    onChange={(e) => setZonalForm({ ...zonalForm, district_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary font-bold"
                  >
                    {DELHI_DISTRICTS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-outline font-extrabold uppercase mb-1">Initial Password</label>
                  <input
                    type="text"
                    required
                    value={zonalForm.password}
                    onChange={(e) => setZonalForm({ ...zonalForm, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary font-mono"
                  />
                  <span className="text-[10px] text-outline mt-1 block">Default: Admin@123 (User can change on first login)</span>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowZonalModal(false)}
                    className="flex-1 py-2.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-on-surface font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingAdmin}
                    className="flex-1 py-2.5 bg-primary hover:bg-primary-container text-on-primary rounded-xl font-bold shadow-md shadow-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {creatingAdmin ? 'Creating...' : 'Create Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminUsersPage;
