import { useState } from "react";
import api from "@/lib/api"; // Axios instance Anda yang sudah ada Header Authorization (JWT)
import { Button } from "@/components/ui/button";
import { Fingerprint, Loader2 } from "lucide-react";
import { startRegistration } from "@simplewebauthn/browser";
import { toast } from "sonner"; // Atau library toast yang Anda pakai

export default function RegisterPasskeyButton() {
    const [isLoading, setIsLoading] = useState(false);
const handleRegister = async () => {
    setIsLoading(true);
    try {
        // 1. Minta Challenge dari Server
        const response = await api.post("/auth/webauthn/register/begin");
        
        // PERBAIKAN DISINI:
        // Ambil data dari dalam properti 'publicKey'
        // Jika response.data.publicKey ada, pakai itu. 
        // Jika tidak (misal backend berubah), coba pakai response.data langsung.
        const options = response.data.publicKey || response.data;

        console.log("Options for WebAuthn:", options); // Debugging

        if (!options?.challenge) {
            throw new Error("Challenge tidak ditemukan. Cek struktur response backend.");
        }

        // 2. Browser proses scan sidik jari/FaceID
        let attResp;
        try {
            // Library sekarang menerima object yang benar (berisi challenge)
            attResp = await startRegistration(options);
        } catch (e) {
            if (e.name === 'NotAllowedError') {
                throw new Error("Pendaftaran dibatalkan user.");
            }
            throw e;
        }

        // 3. Kirim hasil scan ke server
        const verificationResp = await api.post("/auth/webauthn/register/finish", attResp);

        if (verificationResp.data?.success || verificationResp.status === 200) {
            toast.success("Berhasil!", {
                description: "Login sidik jari sekarang sudah aktif."
            });
        }
    } catch (error) {
        console.error("WebAuthn Error:", error);
        toast.error("Gagal Mendaftar", {
            description: error.response?.data?.message || error.message
        });
    } finally {
        setIsLoading(false);
    }
};

    return (
        <Button onClick={handleRegister} disabled={isLoading} variant="outline">
            {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Fingerprint className="mr-2 h-4 w-4" />
            )}
            {isLoading ? "Mendaftarkan..." : "Aktifkan Login Passkey"}
        </Button>
    );
}