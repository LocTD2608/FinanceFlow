const { renameIncomeCategories } = require('../src/seeds/rename-income-categories');

// Category giả lập: lưu trong mảng, hỗ trợ exists/updateOne theo filter đơn giản
const makeCategory = (docs) => ({
  exists: jest.fn(async (f) => docs.some((d) => d.name === f.name && d.userId === f.userId && d.isDefault === f.isDefault && d.type === f.type) || null),
  updateOne: jest.fn(async (f, update) => {
    const doc = docs.find((d) => d.name === f.name && d.userId === f.userId && d.isDefault === f.isDefault && d.type === f.type);
    if (!doc) return { modifiedCount: 0 };
    doc.name = update.$set.name;
    return { modifiedCount: 1 };
  }),
});

const seedDocs = () => [
  { _id: 1, userId: null, isDefault: true, type: 'income', name: 'Tiền phụ thu' },
  { _id: 2, userId: null, isDefault: true, type: 'income', name: 'Cho vay thu hồi' },
  { _id: 3, userId: null, isDefault: true, type: 'income', name: 'Lương' },
];

describe('renameIncomeCategories', () => {
  test('đổi tên 2 danh mục và giữ nguyên _id', async () => {
    const docs = seedDocs();
    const results = await renameIncomeCategories(makeCategory(docs));

    expect(results.map((r) => r.status)).toEqual(['renamed', 'renamed']);
    expect(docs.find((d) => d._id === 1).name).toBe('Công việc phụ');
    expect(docs.find((d) => d._id === 2).name).toBe('Vay mượn');
    expect(docs.find((d) => d._id === 3).name).toBe('Lương');
  });

  test('chạy lại lần 2 thì bỏ qua, không lỗi', async () => {
    const docs = seedDocs();
    const Category = makeCategory(docs);
    await renameIncomeCategories(Category);
    const second = await renameIncomeCategories(Category);

    expect(second.map((r) => r.status)).toEqual(['skipped', 'skipped']);
    expect(docs.filter((d) => d.name === 'Vay mượn')).toHaveLength(1);
  });

  test('không đổi nếu tên mới đã tồn tại (tránh trùng tên)', async () => {
    const docs = [
      ...seedDocs(),
      { _id: 9, userId: null, isDefault: true, type: 'income', name: 'Vay mượn' },
    ];
    const results = await renameIncomeCategories(makeCategory(docs));

    expect(results[1].status).toBe('skipped');
    expect(docs.find((d) => d._id === 2).name).toBe('Cho vay thu hồi');
  });
});
