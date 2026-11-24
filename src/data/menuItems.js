import { publicAsset } from "../utils/publicAsset";

export const MENU_CATEGORIES = [
  "All",
  "Ice Cream",
  "Falooda",
  "Sundaes",
];

export const MENU_ITEMS = [
  { id: "strawberry-velvet", name: "Strawberry Velvet", category: "Ice Cream", image: publicAsset("menu/bowl_strawberry.webp") },
  { id: "belgian-dark-cocoa", name: "Belgian Dark Cocoa", category: "Ice Cream", image: publicAsset("menu/bowl_chocolate.png") },
  { id: "madagascar-vanilla", name: "Madagascar Vanilla", category: "Ice Cream", image: publicAsset("menu/bowl_vanilla.webp") },
  { id: "roasted-pistachio", name: "Roasted Pistachio", category: "Ice Cream", image: publicAsset("menu/bowl_pistachio.webp") },
  { id: "royal-rose-falooda", name: "Royal Rose Falooda", category: "Falooda", image: null },
  { id: "kesar-pista-falooda", name: "Kesar Pista Falooda", category: "Falooda", image: null },
  { id: "mango-malai-falooda", name: "Mango Malai Falooda", category: "Falooda", image: publicAsset("menu/bowl_mango.webp") },
  { id: "hot-fudge-sundae", name: "Hot Fudge Sundae", category: "Sundaes", image: publicAsset("menu/chocolate.webp") },
];
