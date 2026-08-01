import React, { useState, useEffect } from 'react'
import api from "@/lib/api"

function useTicketPrices() {
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Kirim parameter active=true
        const catRes = await api.get('/prices', {
          params: { active: true } 
        });
        
        setPrices(catRes.data);
      } catch (error) {
        console.error("Gagal mengambil data kategori:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);
  
  return { prices, loading }
}

export default useTicketPrices