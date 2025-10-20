export function requireManager(req, res, next) {
  if (req.user?.role === 'manager') return next();
  return res.status(403).json({ message: 'Manager access required' });
}