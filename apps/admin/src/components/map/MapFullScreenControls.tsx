import { useMap } from "react-leaflet";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MaximizeIcon, MinimizeIcon } from "lucide-react";

const MapFullScreenControls = () => {
    const map = useMap();
    const [isFullscreen, setIsFullscreen] = useState(false);
    const mapContainerRef = useRef(map.getContainer());

    const toggleFullscreen = (e) => {
        e.preventDefault();
        const elem = mapContainerRef.current;

        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            // Support for Chrome, Firefox, and Safari
            const requestFS = elem.requestFullscreen || elem.webkitRequestFullscreen || elem.mozRequestFullScreen || elem.msRequestFullscreen;
            
            if (requestFS) {
                requestFS.call(elem).catch((err) => {
                    toast.error(`Error: ${err.message}`);
                });
            }
        } else {
            const exitFS = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
            
            if (exitFS) {
                exitFS.call(document);
            }
        }
    };

    useEffect(() => {
        const onFullscreenChange = () =>
            setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", onFullscreenChange);
        return () =>
            document.removeEventListener(
                "fullscreenchange",
                onFullscreenChange
            );
    }, []);

    return (
            <div className="leaflet-control leaflet-bar bg-white dark:bg-gray-800 rounded-md shadow">
                <a
                    href="#"
                    title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
                    onClick={toggleFullscreen}
                    className="flex! items-center justify-center w-8 h-8"
                >
                    {isFullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
                </a>
            </div>
    );
};

export default MapFullScreenControls;