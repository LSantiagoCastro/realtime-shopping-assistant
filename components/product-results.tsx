import { useState, useEffect } from "react";
import ProductCarousel from "./product-carousel";

type ProductResult = {
  name: string;
  category: string;
  color?: string;
  price: number;
  maxPrice?: number;
  imageUrl?: string;
};

// Mock product data
const mockProducts: ProductResult[] = [
  { name: "Classic Running Sneakers", category: "sneakers", color: "red", price: 79.99, imageUrl: "/images/red-sneakers.jpg" },
  { name: "Premium Training Shoes", category: "sneakers", color: "red", price: 99.99, imageUrl: "/images/red-sneakers-2.jpg" },
  { name: "Lightweight Running Shoes", category: "sneakers", color: "red", price: 89.99, imageUrl: "/images/red-sneaker-3.jpg" },
  { name: "Casual Canvas Shoes", category: "sneakers", color: "blue", price: 49.99, imageUrl: "/images/blue-sneakers.jpg" },
  { name: "Cotton T-Shirt", category: "shirts", color: "pink", price: 19.99, imageUrl: "/images/pink-shirt-men.jpg" },
  { name: "Designer Luxury Shirt", category: "shirts", color: "black", price: 129.99, imageUrl: "/images/black-gucci-shirt-men.jpg" },
  { name: "Classic Oxford Shirt", category: "shirts", color: "white", price: 49.99, imageUrl: "/images/white-shirt-men.jpg" },
  { name: "Leather Jacket", category: "jackets", color: "black", price: 149.99, imageUrl: "/images/black-jacket.jpg" },
  { name: "Winter Parka", category: "jackets", color: "black", price: 199.99, imageUrl: "/images/winter-parka-black.jpg" },
];

type ProductResultsProps = {
  toolCall: any;
};

// Mapeo de términos en español a inglés
const categoryMapping: Record<string, string> = {
  "zapatillas": "sneakers",
  "zapatilla": "sneakers",
  "tenis": "sneakers",
  "calzado deportivo": "sneakers",
  "camisas": "shirts",
  "camisa": "shirts",
  "playera": "shirts",
  "polera": "shirts",
  "remera": "shirts",
  "chaquetas": "jackets",
  "chaqueta": "jackets",
  "abrigo": "jackets",
  "chamarra": "jackets"
};

const colorMapping: Record<string, string> = {
  "rojas": "red",
  "rojo": "red",
  "azules": "blue",
  "azul": "blue",
  "blancas": "white",
  "blanco": "white",
  "negras": "black",
  "negro": "black",
  "rosadas": "pink",
  "rosa": "pink",
  "rosado": "pink"
};

export default function ProductResults({ toolCall }: ProductResultsProps) {
  const [highlightedProductIds, setHighlightedProductIds] = useState<string[]>([]);
  const [hasFilters, setHasFilters] = useState(false);
  const [filterSummary, setFilterSummary] = useState<{
    category?: string;
    color?: string;
    maxPrice?: number;
    count: number;
  }>({ count: 0 });

  useEffect(() => {
    if (toolCall && toolCall.name === "filter_products") {
      try {
        console.log("ProductResults received toolCall:", toolCall);
        
        // Primero, intentar extraer el objeto de argumentos
        let args;
        try {
          if (typeof toolCall.arguments === 'string') {
            console.log("Raw arguments string:", toolCall.arguments);
            args = JSON.parse(toolCall.arguments);
          } else if (typeof toolCall.arguments === 'object') {
            args = toolCall.arguments;
          } else {
            console.error("Unexpected arguments format:", typeof toolCall.arguments);
            args = { category: "sneakers", color: "red" }; // Fallback por defecto
          }
        } catch (e) {
          console.error("Error parsing JSON:", e);
          
          // Intento de recuperación para strings con formato incorrecto
          if (typeof toolCall.arguments === 'string') {
            const argString = toolCall.arguments;
            
            // Intentar extraer categoría y color de la cadena
            const categoryMatch = argString.match(/category["']?\s*[:=]\s*["']?([^"',}]+)["']?/i);
            const colorMatch = argString.match(/color["']?\s*[:=]\s*["']?([^"',}]+)["']?/i);
            
            const category = categoryMatch ? categoryMatch[1].trim() : "sneakers";
            const color = colorMatch ? colorMatch[1].trim() : "red";
            
            console.log("Extracted from string:", { category, color });
            args = { category, color };
          } else {
            args = { category: "sneakers", color: "red" }; // Fallback por defecto
          }
        }
        
        console.log("Parsed arguments:", args);
        
        // Usar los argumentos extraídos para filtrar
        if (args) {
          filterProducts(args);
        }
      } catch (e) {
        console.error("Failed to process tool call in ProductResults:", e);
        
        // En caso de error, mostrar algunos productos predeterminados
        filterProducts({ category: "sneakers", color: "red" });
      }
    } else {
      // Si no hay toolCall, mostrar todos los productos sin destacar ninguno
      setHighlightedProductIds([]);
      setHasFilters(false);
      setFilterSummary({ count: 0 });
    }
  }, [toolCall]);

  const filterProducts = (filters: any) => {
    let filtered = [...mockProducts];
    console.log("Filtering with raw filters:", filters);
    setHasFilters(true);

    // Filter by category
    if (filters.category) {
      const categoryToSearch = categoryMapping[filters.category.toLowerCase()] || filters.category.toLowerCase();
      console.log("Searching for category:", categoryToSearch);
      
      filtered = filtered.filter(p => 
        p.category.toLowerCase() === categoryToSearch
      );
    }

    // Filter by color
    if (filters.color) {
      const colorToSearch = colorMapping[filters.color.toLowerCase()] || filters.color.toLowerCase();
      console.log("Searching for color:", colorToSearch);
      
      filtered = filtered.filter(p => 
        p.color && p.color.toLowerCase() === colorToSearch
      );
    }

    // Filter by max price
    if (filters.max_price) {
      filtered = filtered.filter(p => p.price <= filters.max_price);
    }

    console.log("Found products:", filtered.length);
    
    // Actualizar el resumen del filtro
    setFilterSummary({
      category: filters.category,
      color: filters.color,
      maxPrice: filters.max_price,
      count: filtered.length
    });
    
    // En lugar de actualizar los resultados, actualizamos los IDs destacados
    const highlightedIds = filtered.map((_, index) => {
      // Encontrar el índice correspondiente en mockProducts
      const mockIndex = mockProducts.findIndex(mock => 
        mock.name === filtered[index].name && 
        mock.category === filtered[index].category &&
        mock.price === filtered[index].price
      );
      return String(mockIndex);
    }).filter(id => id !== '-1');
    
    setHighlightedProductIds(highlightedIds);
  };

  return (
    <div className="space-y-6">
      {/* Carrusel siempre visible en la parte superior */}
      <div className="w-full mb-6">
        <ProductCarousel 
          products={mockProducts} 
          highlighted={highlightedProductIds} 
        />
      </div>
      
      {/* Información del filtro aplicado (si existe) */}
      {hasFilters && (
        <div className="bg-[var(--bg-secondary)] bg-opacity-50 border border-[var(--border-color)] p-4 rounded-lg">
          <h3 className="font-bold text-lg text-[var(--accent-primary)]">
            Filter Results: {filterSummary.count} products found
          </h3>
          {highlightedProductIds.length > 0 ? (
            <div className="mt-2">
              <p className="text-[var(--text-secondary)]">
                Products highlighted in the carousel
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {filterSummary.category && (
                  <span className="px-3 py-1 bg-[var(--accent-primary)] bg-opacity-10 text-white rounded-full text-sm flex items-center">
                    <span className="font-medium mr-1">Category:</span> {filterSummary.category}
                  </span>
                )}
                {filterSummary.color && (
                  <span className="px-3 py-1 bg-purple-900 bg-opacity-20 text-purple-400 rounded-full text-sm flex items-center">
                    <span className="font-medium mr-1">Color:</span> {filterSummary.color}
                  </span>
                )}
                {filterSummary.maxPrice && (
                  <span className="px-3 py-1 bg-green-900 bg-opacity-20 text-green-400 rounded-full text-sm flex items-center">
                    <span className="font-medium mr-1">Price:</span> &lt; ${filterSummary.maxPrice}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-yellow-500 mt-1">
              No products matching your search were found. Showing all available products.
            </p>
          )}
        </div>
      )}
    </div>
  );
} 