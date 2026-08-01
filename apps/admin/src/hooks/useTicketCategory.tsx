import React, { useState, useEffect } from 'react'
import api from "@/lib/api"

function useTicketCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Kirim parameter active=true
        const catRes = await api.get('/categories', {
          params: { active: true } 
        });
        
        setCategories(catRes.data);
      } catch (error) {
        console.error("Gagal mengambil data kategori:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);
  
  return { categories, loading }
}

export default useTicketCategories