export function getCurrentUser() {
  // TODO: Implement JWT/cookie/session retrieval
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

export function logoutUser() {
  localStorage.removeItem('user');
}
