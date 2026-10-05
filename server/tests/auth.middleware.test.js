const jwt = require('jsonwebtoken');
const auth = require('../src/middleware/auth');

const SECRET = process.env.JWT_SECRET || 'financeflow_dev_jwt_secret_2026';

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('auth middleware', () => {
  it('thiếu header Authorization -> 401', () => {
    const res = mockRes();
    const next = jest.fn();
    auth({ headers: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('token sai -> 401', () => {
    const res = mockRes();
    const next = jest.fn();
    auth({ headers: { authorization: 'Bearer abc.def.ghi' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('token hợp lệ -> gắn req.user và gọi next', () => {
    const token = jwt.sign({ id: 'u1', email: 'a@b.c' }, SECRET, { expiresIn: '1h' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = jest.fn();
    auth(req, mockRes(), next);
    expect(req.user).toEqual({ id: 'u1', email: 'a@b.c' });
    expect(next).toHaveBeenCalled();
  });
});
