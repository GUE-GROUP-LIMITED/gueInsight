import { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminTopbarControls from '../components/AdminTopbarControls';
import { AuthContext } from '../context/AuthContext';
import { api } from '../services/api';
import './AdminAccessControl.css';

const prettyRole = (role) => {
  const value = String(role || 'admin').replace(/_/g, ' ');
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const AdminAccessControl = () => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [metadata, setMetadata] = useState({ roles: {}, permissions: {}, current_user: null });
  const [admins, setAdmins] = useState([]);

  const [inviteForm, setInviteForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    admin_role: 'admin',
    permissions: [],
  });
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [lastActivationLink, setLastActivationLink] = useState('');

  const [editingAdminId, setEditingAdminId] = useState(null);
  const [editRole, setEditRole] = useState('admin');
  const [editPermissions, setEditPermissions] = useState([]);
  const [savingAccess, setSavingAccess] = useState(false);

  const permissionKeys = useMemo(() => Object.keys(metadata.permissions || {}), [metadata.permissions]);
  const roleKeys = useMemo(() => Object.keys(metadata.roles || {}), [metadata.roles]);

  const roleDefaultPermissions = (role) => {
    return metadata.roles?.[role]?.permissions || [];
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const [metaResponse, usersResponse] = await Promise.all([
        api.get('/api/admin/access/metadata'),
        api.get('/admin_subscribers'),
      ]);

      const loadedMetadata = metaResponse.data || {};
      const loadedAdmins = Array.isArray(usersResponse.data?.admins)
        ? usersResponse.data.admins
        : (Array.isArray(usersResponse.data?.users) ? usersResponse.data.users.filter((item) => item.role === 'admin') : []);

      setMetadata({
        roles: loadedMetadata.roles || {},
        permissions: loadedMetadata.permissions || {},
        current_user: loadedMetadata.current_user || null,
      });
      setAdmins(loadedAdmins);

      const firstRole = Object.keys(loadedMetadata.roles || {})[0] || 'admin';
      setInviteForm((current) => ({
        ...current,
        admin_role: current.admin_role || firstRole,
        permissions: current.permissions.length ? current.permissions : (loadedMetadata.roles?.[current.admin_role || firstRole]?.permissions || []),
      }));
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Unable to load admin access controls.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleInvitePermission = (permission) => {
    setInviteForm((current) => {
      const hasPermission = current.permissions.includes(permission);
      return {
        ...current,
        permissions: hasPermission
          ? current.permissions.filter((item) => item !== permission)
          : [...current.permissions, permission],
      };
    });
  };

  const toggleEditPermission = (permission) => {
    setEditPermissions((current) => {
      const hasPermission = current.includes(permission);
      return hasPermission ? current.filter((item) => item !== permission) : [...current, permission];
    });
  };

  const submitInvite = async (event) => {
    event.preventDefault();
    try {
      setInviteSubmitting(true);
      setError('');
      setSuccess('');
      setLastActivationLink('');

      const response = await api.post('/api/admin/invitations', inviteForm);
      setSuccess(response.data?.message || 'Invitation sent successfully.');
      setLastActivationLink(response.data?.activation_link || '');
      setInviteForm((current) => ({
        ...current,
        email: '',
        first_name: '',
        last_name: '',
        phone_number: '',
      }));
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Unable to send invitation.');
    } finally {
      setInviteSubmitting(false);
    }
  };

  const startEdit = (admin) => {
    setEditingAdminId(admin.id);
    setEditRole(admin.admin_role || 'admin');
    setEditPermissions(Array.isArray(admin.admin_permissions) ? admin.admin_permissions : roleDefaultPermissions(admin.admin_role || 'admin'));
  };

  const cancelEdit = () => {
    setEditingAdminId(null);
    setEditRole('admin');
    setEditPermissions([]);
  };

  const saveAccess = async (adminId) => {
    try {
      setSavingAccess(true);
      setError('');
      setSuccess('');

      const response = await api.patch(`/api/admin/users/${adminId}/access`, {
        admin_role: editRole,
        permissions: editPermissions,
      });

      setSuccess(response.data?.message || 'Access updated successfully.');
      cancelEdit();
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Unable to update admin access.');
    } finally {
      setSavingAccess(false);
    }
  };

  return (
    <div className="admin-access-page">
      <aside className="admin-access-page__sidebar">
        <h2>Admin security</h2>
        <p>Invite staff users and assign least-privilege access safely.</p>
        <nav>
          <Link to="/admin">Dashboard</Link>
          <Link to="/admin/users">Users</Link>
          <Link to="/admin/access" className="is-active">Roles & access</Link>
          <Link to="/admin/compliance">Compliance</Link>
        </nav>
      </aside>

      <section className="admin-access-page__main">
        <header className="admin-access-page__topbar">
          <AdminTopbarControls
            searchPlaceholder="Search access settings"
            searchAriaLabel="Search access settings"
            primaryActionHref="/admin/access"
            primaryActionLabel="Access controls"
          />
        </header>

        <div className="admin-access-page__content">
          <div className="admin-access-page__heading">
            <h1>Role & privilege control</h1>
            <p>
              Signed in as <strong>{user?.email || metadata.current_user?.email || 'admin'}</strong>
            </p>
          </div>

          {error ? <div className="admin-access-page__notice is-error">{error}</div> : null}
          {success ? <div className="admin-access-page__notice is-success">{success}</div> : null}

          {loading ? (
            <div className="admin-access-page__panel">Loading admin access policies...</div>
          ) : (
            <>
              <section className="admin-access-page__panel">
                <h2>Invite admin user</h2>
                <form className="admin-access-page__invite" onSubmit={submitInvite}>
                  <label>
                    Email
                    <input
                      type="email"
                      required
                      value={inviteForm.email}
                      onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
                    />
                  </label>
                  <label>
                    First name
                    <input
                      type="text"
                      value={inviteForm.first_name}
                      onChange={(event) => setInviteForm((current) => ({ ...current, first_name: event.target.value }))}
                    />
                  </label>
                  <label>
                    Last name
                    <input
                      type="text"
                      value={inviteForm.last_name}
                      onChange={(event) => setInviteForm((current) => ({ ...current, last_name: event.target.value }))}
                    />
                  </label>
                  <label>
                    Phone
                    <input
                      type="text"
                      value={inviteForm.phone_number}
                      onChange={(event) => setInviteForm((current) => ({ ...current, phone_number: event.target.value }))}
                    />
                  </label>
                  <label>
                    Role template
                    <select
                      value={inviteForm.admin_role}
                      onChange={(event) => {
                        const nextRole = event.target.value;
                        setInviteForm((current) => ({
                          ...current,
                          admin_role: nextRole,
                          permissions: roleDefaultPermissions(nextRole),
                        }));
                      }}
                    >
                      {roleKeys.map((role) => (
                        <option value={role} key={role}>{prettyRole(role)}</option>
                      ))}
                    </select>
                  </label>

                  <div className="admin-access-page__permissions">
                    <p>Permissions</p>
                    <div className="admin-access-page__permission-grid">
                      {permissionKeys.map((permission) => (
                        <label key={permission} className="admin-access-page__permission-item">
                          <input
                            type="checkbox"
                            checked={inviteForm.permissions.includes(permission)}
                            onChange={() => toggleInvitePermission(permission)}
                          />
                          <span>
                            <strong>{permission}</strong>
                            <small>{metadata.permissions[permission]}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <button type="submit" disabled={inviteSubmitting}>
                    {inviteSubmitting ? 'Sending invite...' : 'Send invite'}
                  </button>
                </form>

                {lastActivationLink ? (
                  <div className="admin-access-page__testing-link">
                    <strong>Testing activation link</strong>
                    <a href={lastActivationLink} target="_blank" rel="noreferrer">{lastActivationLink}</a>
                  </div>
                ) : null}
              </section>

              <section className="admin-access-page__panel">
                <h2>Admin accounts</h2>
                <div className="admin-access-page__table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Privileges</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admins.map((admin) => {
                        const rowEditing = editingAdminId === admin.id;
                        const roleValue = rowEditing ? editRole : (admin.admin_role || 'admin');
                        const permissionValue = rowEditing ? editPermissions : (Array.isArray(admin.admin_permissions) ? admin.admin_permissions : []);
                        return (
                          <tr key={admin.id}>
                            <td>{admin.email}</td>
                            <td>
                              {rowEditing ? (
                                <select
                                  value={editRole}
                                  onChange={(event) => {
                                    const nextRole = event.target.value;
                                    setEditRole(nextRole);
                                    setEditPermissions(roleDefaultPermissions(nextRole));
                                  }}
                                >
                                  {roleKeys.map((role) => (
                                    <option value={role} key={role}>{prettyRole(role)}</option>
                                  ))}
                                </select>
                              ) : prettyRole(roleValue)}
                            </td>
                            <td>{admin.is_active ? 'Active' : 'Pending invite'}</td>
                            <td>
                              {rowEditing ? (
                                <div className="admin-access-page__edit-permissions">
                                  {permissionKeys.map((permission) => (
                                    <label key={permission}>
                                      <input
                                        type="checkbox"
                                        checked={permissionValue.includes(permission)}
                                        onChange={() => toggleEditPermission(permission)}
                                      />
                                      <span>{permission}</span>
                                    </label>
                                  ))}
                                </div>
                              ) : (
                                <div className="admin-access-page__chips">
                                  {permissionValue.length ? permissionValue.map((item) => (
                                    <span key={item}>{item}</span>
                                  )) : <span>No custom privileges</span>}
                                </div>
                              )}
                            </td>
                            <td>
                              {rowEditing ? (
                                <div className="admin-access-page__row-actions">
                                  <button type="button" disabled={savingAccess} onClick={() => saveAccess(admin.id)}>
                                    {savingAccess ? 'Saving...' : 'Save'}
                                  </button>
                                  <button type="button" className="ghost" onClick={cancelEdit}>Cancel</button>
                                </div>
                              ) : (
                                <button type="button" onClick={() => startEdit(admin)}>Edit access</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default AdminAccessControl;
