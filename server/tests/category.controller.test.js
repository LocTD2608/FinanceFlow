/**
 * Unit test cho API Danh mục (controller).
 * Các model Mongoose được mock nên test chạy không cần MongoDB.
 */
const mongoose = require('mongoose');

jest.mock('../src/models/Category', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
}));
jest.mock('../src/models/Transaction', () => ({
  exists: jest.fn(),
  countDocuments: jest.fn(),
  updateMany: jest.fn(),
}));
jest.mock('../src/models/Budget', () => ({
  deleteMany: jest.fn(),
}));

const Category = require('../src/models/Category');
const Transaction = require('../src/models/Transaction');
const Budget = require('../src/models/Budget');
const ctrl = require('../src/controllers/category.controller');

// ───────── Helpers ─────────
const newId = () => new mongoose.Types.ObjectId().toString();
const USER_ID = newId();

// Query giả: hỗ trợ chain .collation().sort().lean() và await trực tiếp
const query = (value) => {
  const q = {
    collation: () => q,
    sort: () => q,
    lean: () => q,
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return q;
};

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockReq = (overrides = {}) => ({
  user: { id: USER_ID },
  params: {},
  query: {},
  body: {},
  ...overrides,
});

const makeCategory = (overrides = {}) => ({
  _id: newId(),
  userId: USER_ID,
  name: 'Ăn vặt',
  type: 'expense',
  icon: 'circle',
  color: '#6B7280',
  isDefault: false,
  isDeleted: false,
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const body = (res) => res.json.mock.calls[0][0];

beforeEach(() => {
  jest.resetAllMocks();
});

// ───────── GET /api/categories ─────────
describe('list (US-CAT-01)', () => {
  it('trả danh sách danh mục của user + mặc định, bỏ qua danh mục đã xóa', async () => {
    const cats = [makeCategory({ isDefault: true, userId: null, name: 'Ăn uống' }), makeCategory()];
    Category.find.mockReturnValue(query(cats));
    const res = mockRes();

    await ctrl.list(mockReq(), res);

    const filter = Category.find.mock.calls[0][0];
    expect(filter.isDeleted).toEqual({ $ne: true });
    expect(filter.$or).toEqual([{ userId: null }, { userId: USER_ID }]);
    expect(body(res).success).toBe(true);
    expect(body(res).data).toHaveLength(2);
    expect(body(res).data[0]).toHaveProperty('icon');
  });

  it('lọc theo type hợp lệ', async () => {
    Category.find.mockReturnValue(query([]));
    await ctrl.list(mockReq({ query: { type: 'income' } }), mockRes());
    expect(Category.find.mock.calls[0][0].type).toBe('income');
  });

  it('type không hợp lệ -> 400', async () => {
    const res = mockRes();
    await ctrl.list(mockReq({ query: { type: 'abc' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(Category.find).not.toHaveBeenCalled();
  });
});

// ───────── GET /api/categories/:id ─────────
describe('getById', () => {
  it('id sai định dạng -> 400', async () => {
    const res = mockRes();
    await ctrl.getById(mockReq({ params: { id: 'xyz' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('không tìm thấy -> 404', async () => {
    Category.findOne.mockReturnValue(query(null));
    const res = mockRes();
    await ctrl.getById(mockReq({ params: { id: newId() } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('tìm thấy -> trả dữ liệu', async () => {
    const cat = makeCategory();
    Category.findOne.mockReturnValue(query(cat));
    const res = mockRes();
    await ctrl.getById(mockReq({ params: { id: String(cat._id) } }), res);
    expect(body(res).data.name).toBe('Ăn vặt');
  });
});

// ───────── POST /api/categories ─────────
describe('create (US-CAT-02)', () => {
  it('thiếu tên -> 400', async () => {
    const res = mockRes();
    await ctrl.create(mockReq({ body: { name: '   ', type: 'expense' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(Category.create).not.toHaveBeenCalled();
  });

  it('type không hợp lệ -> 400', async () => {
    const res = mockRes();
    await ctrl.create(mockReq({ body: { name: 'Cafe', type: 'other' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('trùng tên trong cùng loại -> 409', async () => {
    Category.findOne.mockReturnValue(query(makeCategory()));
    const res = mockRes();
    await ctrl.create(mockReq({ body: { name: 'Ăn vặt', type: 'expense' } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(Category.create).not.toHaveBeenCalled();
  });

  it('tạo thành công -> 201, trim tên, gán userId', async () => {
    Category.findOne.mockReturnValue(query(null));
    Category.create.mockImplementation(async (data) => makeCategory(data));
    const res = mockRes();

    await ctrl.create(
      mockReq({ body: { name: '  Cafe  ', type: 'expense', icon: 'coffee', color: '#111111' } }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(201);
    const created = Category.create.mock.calls[0][0];
    expect(created).toMatchObject({
      userId: USER_ID,
      name: 'Cafe',
      type: 'expense',
      icon: 'coffee',
      color: '#111111',
      isDefault: false,
    });
    expect(body(res).data.name).toBe('Cafe');
  });
});

// ───────── PUT /api/categories/:id ─────────
describe('update (US-CAT-05)', () => {
  it('danh mục mặc định -> 403', async () => {
    Category.findOne.mockReturnValue(query(makeCategory({ userId: null, isDefault: true })));
    const res = mockRes();
    await ctrl.update(mockReq({ params: { id: newId() }, body: { name: 'X' } }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('danh mục của người khác -> 404', async () => {
    Category.findOne.mockReturnValue(query(makeCategory({ userId: newId() })));
    const res = mockRes();
    await ctrl.update(mockReq({ params: { id: newId() }, body: { name: 'X' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('không tồn tại / đã xóa -> 404', async () => {
    Category.findOne.mockReturnValue(query(null));
    const res = mockRes();
    await ctrl.update(mockReq({ params: { id: newId() }, body: { name: 'X' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('không đổi type khi đã có giao dịch -> 400', async () => {
    Category.findOne.mockReturnValue(query(makeCategory()));
    Transaction.exists.mockResolvedValue({ _id: newId() });
    const res = mockRes();
    await ctrl.update(mockReq({ params: { id: newId() }, body: { type: 'income' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('trùng tên với danh mục khác -> 409', async () => {
    const cat = makeCategory();
    Category.findOne
      .mockReturnValueOnce(query(cat)) // getOwnedCategory
      .mockReturnValueOnce(query(makeCategory({ name: 'Cafe' }))); // isNameTaken
    const res = mockRes();
    await ctrl.update(mockReq({ params: { id: String(cat._id) }, body: { name: 'Cafe' } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(cat.save).not.toHaveBeenCalled();
  });

  it('sửa thành công -> lưu và trả dữ liệu mới', async () => {
    const cat = makeCategory();
    Category.findOne
      .mockReturnValueOnce(query(cat))
      .mockReturnValueOnce(query(null));
    const res = mockRes();

    await ctrl.update(
      mockReq({ params: { id: String(cat._id) }, body: { name: ' Trà sữa ', icon: 'cup' } }),
      res
    );

    expect(cat.save).toHaveBeenCalled();
    expect(body(res).success).toBe(true);
    expect(body(res).data.name).toBe('Trà sữa');
    expect(body(res).data.icon).toBe('cup');
  });
});

// ───────── DELETE /api/categories/:id ─────────
describe('remove (US-CAT-05)', () => {
  it('id sai định dạng -> 400', async () => {
    const res = mockRes();
    await ctrl.remove(mockReq({ params: { id: 'bad' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('danh mục mặc định -> 403, không xóa', async () => {
    Category.findOne.mockReturnValue(query(makeCategory({ userId: null, isDefault: true })));
    const res = mockRes();
    await ctrl.remove(mockReq({ params: { id: newId() } }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(Budget.deleteMany).not.toHaveBeenCalled();
  });

  it('không có giao dịch -> xóa mềm ngay và xóa ngân sách liên quan', async () => {
    const cat = makeCategory();
    Category.findOne.mockReturnValue(query(cat));
    Transaction.countDocuments.mockResolvedValue(0);
    const res = mockRes();

    await ctrl.remove(mockReq({ params: { id: String(cat._id) } }), res);

    expect(cat.isDeleted).toBe(true);
    expect(cat.deletedAt).toBeInstanceOf(Date);
    expect(cat.save).toHaveBeenCalled();
    expect(Budget.deleteMany).toHaveBeenCalledWith({ userId: USER_ID, categoryId: cat._id });
    expect(Transaction.updateMany).not.toHaveBeenCalled();
    expect(body(res).success).toBe(true);
  });

  it('có giao dịch nhưng chưa chọn danh mục đích -> 409 kèm transactionCount', async () => {
    const cat = makeCategory();
    Category.findOne.mockReturnValue(query(cat));
    Transaction.countDocuments.mockResolvedValue(20);
    const res = mockRes();

    await ctrl.remove(mockReq({ params: { id: String(cat._id) } }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(body(res).transactionCount).toBe(20);
    expect(cat.save).not.toHaveBeenCalled();
    expect(Transaction.updateMany).not.toHaveBeenCalled();
  });

  it('reassignTo = id danh mục hợp lệ -> chuyển giao dịch rồi xóa mềm', async () => {
    const cat = makeCategory();
    const target = makeCategory({ name: 'Ăn uống' });
    Category.findOne
      .mockReturnValueOnce(query(cat))
      .mockReturnValueOnce(query(target));
    Transaction.countDocuments.mockResolvedValue(20);
    const res = mockRes();

    await ctrl.remove(
      mockReq({ params: { id: String(cat._id) }, query: { reassignTo: String(target._id) } }),
      res
    );

    expect(Transaction.updateMany).toHaveBeenCalledWith(
      { userId: USER_ID, categoryId: cat._id },
      { $set: { categoryId: target._id } }
    );
    expect(cat.isDeleted).toBe(true);
    expect(body(res).movedTransactions).toBe(20);
  });

  it('reassignTo = other -> chuyển sang danh mục "Khác" mặc định cùng loại', async () => {
    const cat = makeCategory();
    const other = makeCategory({ userId: null, isDefault: true, name: 'Khác (Chi)' });
    Category.findOne
      .mockReturnValueOnce(query(cat))
      .mockReturnValueOnce(query(other));
    Transaction.countDocuments.mockResolvedValue(3);
    const res = mockRes();

    await ctrl.remove(
      mockReq({ params: { id: String(cat._id) }, query: { reassignTo: 'other' } }),
      res
    );

    const filter = Category.findOne.mock.calls[1][0];
    expect(filter).toMatchObject({ userId: null, isDefault: true, type: 'expense' });
    expect(Transaction.updateMany).toHaveBeenCalledWith(
      { userId: USER_ID, categoryId: cat._id },
      { $set: { categoryId: other._id } }
    );
    expect(cat.isDeleted).toBe(true);
  });

  it('reassignTo sai định dạng -> 400', async () => {
    Category.findOne.mockReturnValue(query(makeCategory()));
    Transaction.countDocuments.mockResolvedValue(1);
    const res = mockRes();
    await ctrl.remove(mockReq({ params: { id: newId() }, query: { reassignTo: 'zzz' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('reassignTo trùng chính danh mục đang xóa -> 400', async () => {
    const cat = makeCategory();
    Category.findOne.mockReturnValue(query(cat));
    Transaction.countDocuments.mockResolvedValue(1);
    const res = mockRes();
    await ctrl.remove(
      mockReq({ params: { id: String(cat._id) }, query: { reassignTo: String(cat._id) } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(cat.save).not.toHaveBeenCalled();
  });

  it('danh mục đích không tồn tại -> 404', async () => {
    Category.findOne
      .mockReturnValueOnce(query(makeCategory()))
      .mockReturnValueOnce(query(null));
    Transaction.countDocuments.mockResolvedValue(1);
    const res = mockRes();
    await ctrl.remove(mockReq({ params: { id: newId() }, query: { reassignTo: newId() } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('danh mục đích khác loại thu/chi -> 400', async () => {
    Category.findOne
      .mockReturnValueOnce(query(makeCategory({ type: 'expense' })))
      .mockReturnValueOnce(query(makeCategory({ type: 'income' })));
    Transaction.countDocuments.mockResolvedValue(1);
    const res = mockRes();
    await ctrl.remove(mockReq({ params: { id: newId() }, query: { reassignTo: newId() } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(Transaction.updateMany).not.toHaveBeenCalled();
  });
});
