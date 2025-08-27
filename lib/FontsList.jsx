// lib/FontsList.js - FIXED VERSION with zero-based indexing

export const availableFonts_Classic = [
    { name: "Arvo", id: 0, class: "font-arvo" },                    // index 0
    { name: "Bitter", id: 1, class: "font-bitter" },               // index 1  
    { name: "Bungee Spice", id: 2, class: "font-bungee-spice" },   // index 2
    { name: "Calistoga", id: 3, class: "font-calistoga" },         // index 3
    { name: "Crimson Text", id: 4, class: "font-crimson-text" },   // index 4
    { name: "Dancing Script", id: 5, class: "font-dancing-script" }, // index 5
    { name: "EB Garamond", id: 6, class: "font-eb-garamond" },     // index 6
    { name: "Handjet", id: 7, class: "font-handjet" },             // index 7
    { name: "IBM Plex Serif", id: 8, class: "font-ibm-plex-serif" }, // index 8
    { name: "Libre Baskerville", id: 9, class: "font-libre-baskerville" }, // index 9
    { name: "Lora", id: 10, class: "font-lora" },                  // index 10
    { name: "Noto Sans JP", id: 11, class: "font-noto-sans-jp" },  // index 11
    { name: "Noto Sans SC", id: 12, class: "font-noto-sans-sc" },  // index 12
];

// ✅ HELPER FUNCTION: Get font by index (safer than direct array access)
export function getFontByIndex(index) {
    const validIndex = Math.max(0, Math.min(index || 0, availableFonts_Classic.length - 1));
    return availableFonts_Classic[validIndex];
}

// ✅ HELPER FUNCTION: Get font by ID (for backwards compatibility)
export function getFontById(id) {
    return availableFonts_Classic.find(font => font.id === id) || availableFonts_Classic[0];
}