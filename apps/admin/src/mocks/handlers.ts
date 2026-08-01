// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

// Data mock awal
const mockFiles = [
  {
    id: 'file-1',
    name: 'Jalan Utama',
    original_filename: 'jalan_utama.geojson',
    file_url: 'path/to/jalan_utama.geojson',
    created_at: '2023-01-01T10:00:00Z',
    is_active: true,
    category: { id: 'cat-1', name: 'Infrastruktur' },
  },
  {
    id: 'file-2',
    name: 'Batas Administrasi',
    original_filename: 'batas_administrasi.geojson',
    file_url: 'path/to/batas_administrasi.geojson',
    created_at: '2023-01-05T12:30:00Z',
    is_active: false,
    category: { id: 'cat-2', name: 'Administrasi' },
  },
];

const mockCategories = [
  { id: 'cat-1', name: 'Infrastruktur' },
  { id: 'cat-2', name: 'Administrasi' },
  { id: 'cat-3', name: 'Lingkungan' },
];

const mockDetails = {
  'file-1': {
    data: [
      { id: 'feature-1-1', type: 'Feature', geometry: {}, properties: { nama_jalan: 'Jl. Sudirman', panjang: 1000 } },
      { id: 'feature-1-2', type: 'Feature', geometry: {}, properties: { nama_jalan: 'Jl. Thamrin', panjang: 1200 } },
    ],
    meta: { current_page: 1, last_page: 1, per_page: 10, total: 2 },
  },
  'file-2': {
    data: [
      { id: 'feature-2-1', type: 'Feature', geometry: {}, properties: { nama_desa: 'Desa A', populasi: 5000 } },
    ],
    meta: { current_page: 1, last_page: 1, per_page: 10, total: 1 },
  },
};

export const handlers = [
  // Mock GET /geojson-files
  http.get('/geojson-files', ({ request }) => {
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    const per_page = parseInt(url.searchParams.get('per_page') || '5');
    const category_id = url.searchParams.get('category_id');

    let filteredFiles = [...mockFiles];
    if (category_id) {
      filteredFiles = filteredFiles.filter(f => f.category.id === category_id);
    }

    const total = filteredFiles.length;
    const start = (parseInt(page) - 1) * per_page;
    const end = start + per_page;
    const paginatedFiles = filteredFiles.slice(start, end);

    return HttpResponse.json({
      data: paginatedFiles,
      meta: {
        current_page: parseInt(page),
        last_page: Math.ceil(total / per_page),
        per_page: per_page,
        total: total,
      },
    });
  }),

  // Mock GET /categories
  http.get('/categories', () => {
    return HttpResponse.json({ data: mockCategories });
  }),

  // Mock POST /geojson-files (Add new file)
  http.post('/geojson-files', async ({ request }) => {
    const formData = await request.formData();
    const name = formData.get('name') as string;
    const category_id = formData.get('category_id') as string;
    const file = formData.get('file') as File;

    if (!name || !category_id || !file) {
      return new HttpResponse(JSON.stringify({ message: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const newFile = {
      id: `file-${mockFiles.length + 1}`,
      name,
      original_filename: file.name,
      file_url: `path/to/${file.name}`,
      created_at: new Date().toISOString(),
      is_active: false,
      category: mockCategories.find(cat => cat.id === category_id) || { id: category_id, name: 'Unknown' },
    };
    mockFiles.push(newFile); // Tambahkan ke data mock
    return HttpResponse.json(newFile, { status: 201 });
  }),

  // Mock PUT /geojson-files/:id (Edit file)
  http.put('/geojson-files/:id', async ({ params, request }) => {
    const { id } = params;
    const { name, category_id } = await request.json();

    const fileIndex = mockFiles.findIndex(f => f.id === id);
    if (fileIndex === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    if (!name || !category_id) {
      return new HttpResponse(JSON.stringify({ message: 'Missing required fields for update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    mockFiles[fileIndex] = {
      ...mockFiles[fileIndex],
      name,
      category: mockCategories.find(cat => cat.id === category_id) || mockFiles[fileIndex].category,
    };
    return HttpResponse.json(mockFiles[fileIndex]);
  }),

  // Mock DELETE /geojson-files/:id
  http.delete('/geojson-files/:id', ({ params }) => {
    const { id } = params;
    const initialLength = mockFiles.length;
    const fileIndex = mockFiles.findIndex(f => f.id === id);
    if (fileIndex > -1) {
      mockFiles.splice(fileIndex, 1);
    }

    if (mockFiles.length < initialLength) {
      return new HttpResponse(null, { status: 204 });
    } else {
      return new HttpResponse(null, { status: 404 });
    }
  }),

  // Mock GET /geojson-files/:id/details
  http.get('/geojson-files/:id/details', ({ params, request }) => {
    const { id } = params;
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const page = url.searchParams.get('page') || '1';

    let details = mockDetails[id as keyof typeof mockDetails]?.data || [];

    if (search) {
      details = details.filter(feature =>
        Object.values(feature.properties).some(prop =>
          String(prop).toLowerCase().includes(search.toLowerCase())
        )
      );
    }

    const per_page = 10; // Fixed for simplicity in mock
    const total = details.length;
    const start = (parseInt(page) - 1) * per_page;
    const end = start + per_page;
    const paginatedDetails = details.slice(start, end);

    return HttpResponse.json({
      data: paginatedDetails,
      meta: {
        current_page: parseInt(page),
        last_page: Math.ceil(total / per_page),
        per_page: per_page,
        total: total,
      },
    });
  }),

  // Mock PATCH /geojson-files/:id/toggle
  http.patch('/geojson-files/:id/toggle', ({ params }) => {
    const { id } = params;
    const fileIndex = mockFiles.findIndex(f => f.id === id);
    if (fileIndex === -1) {
      return new HttpResponse(null, { status: 404 });
    }
    mockFiles[fileIndex].is_active = !mockFiles[fileIndex].is_active;
    return HttpResponse.json({ success: true, is_active: mockFiles[fileIndex].is_active });
  }),

  // Mock DELETE /features/:id
  http.delete('/features/:id', ({ params }) => {
    const { id } = params;
    // Untuk mock sederhana, kita asumsikan penghapusan selalu berhasil
    // Dalam aplikasi nyata, Anda mungkin perlu memperbarui mockDetails
    return new HttpResponse(null, { status: 204 });
  }),
];