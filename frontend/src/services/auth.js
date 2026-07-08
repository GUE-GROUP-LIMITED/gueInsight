export function getCurrentUser() {
  const user = localStorage.getItem('user');
  if (!user) {
    return null;
  }

  try {
    const parsed = JSON.parse(user);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function logoutUser() {
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  localStorage.removeItem('auth');
}
