// src/services/dataService.js
import api from './api'; // Import instance axios yang sudah Anda buat

/**
 * Mengambil semua data dari endpoint tertentu.
 * @param {string} endpoint - Endpoint API (e.g., '/bts').
 * @returns {Promise<Array>} - Promise yang ber-resolve dengan array data.
 */
export const getAllData = (endpoint) => {
    return api.get(endpoint);
};

/**
 * Mengambil satu data berdasarkan ID.
 * @param {string} endpoint - Endpoint API.
 * @param {string|number} id - ID dari item.
 * @returns {Promise<Object>} - Promise yang ber-resolve dengan objek data.
 */
export const getDataById = (endpoint, id) => {
    return api.get(`${endpoint}/${id}`);
};

/**
 * Membuat data baru.
 * @param {string} endpoint - Endpoint API.
 * @param {Object} data - Objek data yang akan dibuat.
 * @returns {Promise<Object>} - Promise yang ber-resolve dengan data yang baru dibuat.
 */
export const createData = (endpoint, data) => {
    return api.post(endpoint, data);
};

/**
 * Memperbarui data yang ada.
 * @param {string} endpoint - Endpoint API.
 * @param {string|number} id - ID dari item yang akan diperbarui.
 * @param {Object} data - Objek dengan data yang diperbarui.
 * @returns {Promise<Object>} - Promise yang ber-resolve dengan data yang telah diperbarui.
 */
export const updateData = (endpoint, id, data) => {
    return api.put(`${endpoint}/${id}`, data);
};

/**
 * Menghapus data.
 * @param {string} endpoint - Endpoint API.
 * @param {string|number} id - ID dari item yang akan dihapus.
 * @returns {Promise<void>}
 */
export const deleteData = (endpoint, id) => {
    return api.delete(`${endpoint}/${id}`);
};
