import { useEffect, useRef, useState } from "react";
import "./ThreatMap.css";

// Leaflet loaded from CDN via index.html script tags
// Make sure index.html includes:
// <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
// <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

const DARK_TILE = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com">CARTO</a>';

const SEV_COLORS = {
    critical: "#ff3366",
    high: "#ffaa00",
    medium: "#ffdd44",
    low: "#00ff88",
};

export default function ThreatMap({ alerts, fullscreen }) {
    const mapRef = useRef(null);
    const leafletMap = useRef(null);
    const svgOverlay = useRef(null);
    const markersRef = useRef([]);
    const arcsRef = useRef([]);
    const [mapReady, setMapReady] = useState(false);
    const [activeCount, setActiveCount] = useState(0);

    // Init map
    useEffect(() => {
        if (!mapRef.current || leafletMap.current) return;

        // Wait for Leaflet to be available
        const initMap = () => {
            if (!window.L) {
                setTimeout(initMap, 200);
                return;
            }

            const map = window.L.map(mapRef.current, {
                center: [20, 0],
                zoom: 2,
                zoomControl: false,
                attributionControl: false,
                minZoom: 2,
                maxZoom: 8,
            });

            window.L.tileLayer(DARK_TILE, { attribution: TILE_ATTR, subdomains: "abcd" }).addTo(map);
            window.L.control.zoom({ position: "bottomright" }).addTo(map);

            // SVG overlay for attack arcs
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:400;overflow:visible";
            svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

            const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
            // Glow filters for each severity
            Object.entries(SEV_COLORS).forEach(([sev, color]) => {
                const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
                filter.setAttribute("id", `glow-${sev}`);
                const blur = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
                blur.setAttribute("stdDeviation", "2");
                blur.setAttribute("result", "coloredBlur");
                const merge = document.createElementNS("http://www.w3.org/2000/svg", "feMerge");
                const mn1 = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
                mn1.setAttribute("in", "coloredBlur");
                const mn2 = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
                mn2.setAttribute("in", "SourceGraphic");
                merge.appendChild(mn1);
                merge.appendChild(mn2);
                filter.appendChild(blur);
                filter.appendChild(merge);
                defs.appendChild(filter);
            });
            svg.appendChild(defs);

            mapRef.current.querySelector(".leaflet-pane.leaflet-overlay-pane")?.appendChild(svg) ||
                mapRef.current.appendChild(svg);

            svgOverlay.current = svg;
            leafletMap.current = map;
            setMapReady(true);
        };

        initMap();

        return () => {
            if (leafletMap.current) {
                leafletMap.current.remove();
                leafletMap.current = null;
            }
        };
    }, []);

    // Draw arcs and markers on alert change
    useEffect(() => {
        if (!mapReady || !leafletMap.current || !svgOverlay.current) return;
        const map = leafletMap.current;
        const svg = svgOverlay.current;

        // Clear old arcs
        arcsRef.current.forEach(el => el.remove());
        arcsRef.current = [];

        // Clear old markers
        markersRef.current.forEach(m => map.removeLayer(m));
        markersRef.current = [];

        // Take most recent 15 alerts
        const isValidCoord = (geo) => {
            const lat = Number(geo?.lat);
            const lng = Number(geo?.lng);
            return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
        };

        const recentAlerts = alerts
            .filter(alert => isValidCoord(alert.srcGeo) && isValidCoord(alert.dstGeo))
            .slice(0, 30);
        setActiveCount(recentAlerts.length);

        recentAlerts.forEach((alert, idx) => {
            const src = alert.srcGeo;
            const dst = alert.dstGeo;
            const color = SEV_COLORS[alert.severity] || SEV_COLORS.low;

            // Destination marker (our system)
            const dstIcon = window.L.divIcon({
                className: "",
                html: `<div class="map-marker dst ${alert.severity}" style="--color:${color}"></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6],
            });

            // Source marker (attacker)
            const srcIcon = window.L.divIcon({
                className: "",
                html: `<div class="map-marker src ${alert.severity}" style="--color:${color}">
          <div class="marker-pulse" style="background:${color}"></div>
          <div class="marker-core" style="background:${color}"></div>
          <div class="marker-label">${src.code}</div>
        </div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10],
            });

            const srcMarker = window.L.marker([src.lat, src.lng], { icon: srcIcon });
            srcMarker.bindTooltip(
                `<div class="map-tooltip">
          <div class="tt-rule">${alert.rule}</div>
          <div class="tt-meta"><span class="tt-sev ${alert.severity}">${alert.severity.toUpperCase()}</span> · ${src.name}</div>
          <div class="tt-ip">${alert.srcIp}</div>
        </div>`,
                { className: "sentinel-tooltip", direction: "top" }
            );
            srcMarker.addTo(map);
            markersRef.current.push(srcMarker);

            // Draw arc
            const drawArc = () => {
                const p1 = map.latLngToLayerPoint([src.lat, src.lng]);
                const p2 = map.latLngToLayerPoint([dst.lat, dst.lng]);

                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                const offset = -dist * 0.35;
                const perpX = (-dy / dist) * offset;
                const perpY = (dx / dist) * offset;
                const cx = midX + perpX;
                const cy = midY + perpY;

                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                const d = `M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}`;
                path.setAttribute("d", d);
                path.setAttribute("fill", "none");
                path.setAttribute("stroke", color);
                path.setAttribute("stroke-width", alert.severity === "critical" ? "1.5" : "0.8");
                path.setAttribute("stroke-opacity", "0.7");
                path.setAttribute("filter", `url(#glow-${alert.severity})`);
                path.setAttribute("stroke-dasharray", "1000");
                path.setAttribute("stroke-dashoffset", "1000");
                path.style.animation = `arc-draw 1.5s ease forwards ${idx * 0.12}s`;

                // Animated dot along path
                const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                dot.setAttribute("r", alert.severity === "critical" ? "3" : "2");
                dot.setAttribute("fill", color);
                dot.setAttribute("filter", `url(#glow-${alert.severity})`);
                dot.style.opacity = "0";

                const animate = document.createElementNS("http://www.w3.org/2000/svg", "animateMotion");
                animate.setAttribute("dur", `${2 + Math.random() * 2}s`);
                animate.setAttribute("repeatCount", "indefinite");
                animate.setAttribute("begin", `${idx * 0.2}s`);

                const mp = document.createElementNS("http://www.w3.org/2000/svg", "mpath");
                path.setAttribute("id", `arc-path-${idx}`);
                mp.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", `#arc-path-${idx}`);
                animate.appendChild(mp);
                dot.appendChild(animate);
                dot.style.opacity = "1";

                svg.appendChild(path);
                svg.appendChild(dot);
                arcsRef.current.push(path, dot);
            };

            drawArc();

            // Redraw arcs on map move
            map.on("move zoom", drawArc);
        });

        // Jakarta destination marker
        const jakartaIcon = window.L.divIcon({
            className: "",
            html: `<div class="map-marker-home">
        <div class="home-rings"></div>
        <div class="home-core"></div>
      </div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
        });
        const systemLat = Number(import.meta.env.VITE_SYSTEM_LAT || -5.1477);
        const systemLng = Number(import.meta.env.VITE_SYSTEM_LNG || 119.4327);
        const systemName = import.meta.env.VITE_SYSTEM_NAME || "Protected System";

        const homeMarker = window.L.marker([systemLat, systemLng], { icon: jakartaIcon });
        homeMarker.bindTooltip(
            `<div class="map-tooltip"><div class="tt-rule">THIS SYSTEM</div><div class="tt-meta">${systemName} · Protected</div></div>`,
            { className: "sentinel-tooltip" }
        );
        homeMarker.addTo(map);
        markersRef.current.push(homeMarker);

    }, [alerts, mapReady]);

    return (
        <div className={`threat-map-wrapper panel ${fullscreen ? "fullscreen" : ""}`}>
            <div className="panel-header">
                <div className="panel-title">
                    <div className="panel-title-icon" />
                    LIVE THREAT MAP
                </div>
                <div className="map-meta">
                    <span className="mono" style={{ fontSize: "9px", color: "var(--text-muted)" }}>
                        {activeCount} ACTIVE VECTORS
                    </span>
                    <span className="map-live-dot">● LIVE</span>
                </div>
            </div>

            <div className="map-canvas" ref={mapRef} />

            <div className="map-legend">
                {Object.entries(SEV_COLORS).map(([sev, color]) => (
                    <div key={sev} className="legend-item">
                        <span className="legend-dot" style={{ background: color }} />
                        <span style={{ color, fontSize: "9px", fontFamily: "var(--font-mono)", letterSpacing: "1px" }}>
                            {sev.toUpperCase()}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}