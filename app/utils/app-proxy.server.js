import shopifyApp from "../shopify.server";
import { sessionStorage } from "../shopify.server";

/**
 * Obtiene el cliente admin GraphQL desde el shop para usar en app proxy
 * @param {string} shop - El shop domain (ej: "mystore.myshopify.com" o "mystore")
 * @returns {Promise<Object|null>} El cliente admin GraphQL o null si no hay sesión
 */
export async function getAdminFromShop(shop) {
  if (!shop) {
    return null;
  }

  // Normalizar el shop (asegurar que tenga .myshopify.com)
  const normalizedShop = shop.includes('.') ? shop : `${shop}.myshopify.com`;
  
  // La sesión offline tiene el formato: offline_{shop}
  const sessionId = `offline_${normalizedShop}`;
  
  try {
    // Cargar la sesión offline desde el storage
    const session = await sessionStorage.loadSession(sessionId);
    
    if (!session) {
      console.warn(`No se encontró sesión offline para shop: ${normalizedShop}`);
      return null;
    }

    // Crear el cliente GraphQL desde la sesión usando la API de shopifyApp
    // shopifyApp tiene un método clients que devuelve un objeto con graphql
    const admin = shopifyApp.clients.graphql({ session });
    
    return admin;
  } catch (error) {
    console.error(`Error obteniendo admin desde shop ${normalizedShop}:`, error);
    return null;
  }
}

