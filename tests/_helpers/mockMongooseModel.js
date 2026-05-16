// Lightweight in-memory Mongoose model mock for testing services
// that depend on Mongoose models (User, Paper, Tracker, etc.)

export function mockModel(seed = []) {
  const records = [...seed];
  let idCounter = seed.length;

  function nextId() {
    idCounter += 1;
    return `mock-${idCounter}`;
  }

  const api = {
    records,

    async findById(id) {
      const strId = String(id);
      return records.find((r) => String(r._id) === strId) || null;
    },

    async findByIdAndUpdate(id, updates, opts = {}) {
      const strId = String(id);
      const idx = records.findIndex((r) => String(r._id) === strId);
      if (idx === -1) return null;
      records[idx] = { ...records[idx], ...updates };
      return records[idx];
    },

    async findOne(filter) {
      for (const r of records) {
        let match = true;
        for (const [key, val] of Object.entries(filter)) {
          if (r[key] !== val) {
            match = false;
            break;
          }
        }
        if (match) return r;
      }
      return null;
    },

    async findOneAndUpdate(filter, update, opts = {}) {
      const record = await api.findOne(filter);
      if (!record) return null;
      Object.assign(record, update.$inc ? patchInc(record, update) : update);
      if (update.$set) Object.assign(record, update.$set);
      return opts.new ? record : { ...record };
    },

    async create(data) {
      const record = { _id: nextId(), ...data };
      records.push(record);
      return record;
    },

    async find(filter) {
      if (!filter || Object.keys(filter).length === 0) return [...records];
      return records.filter((r) => {
        for (const [key, val] of Object.entries(filter)) {
          if (r[key] !== val) return false;
        }
        return true;
      });
    },

    async countDocuments(filter) {
      return (await api.find(filter)).length;
    },

    async save() {
      // For documents that have a .save() method (like Job model)
      return this;
    },

    // Chainable query builder (lean, sort, limit)
    lean() { return this; },
    sort() { return this; },
    limit(n) {
      const self = this;
      return {
        ...self,
        async exec() {
          return records.slice(0, n);
        },
      };
    },
  };

  return api;
}

function patchInc(record, update) {
  const patched = { ...record };
  for (const [key, val] of Object.entries(update.$inc || {})) {
    patched[key] = (patched[key] || 0) + val;
  }
  return patched;
}

export default { mockModel };
