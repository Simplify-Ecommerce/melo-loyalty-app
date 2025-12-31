import { authenticate } from "../shopify.server";
import { getAdminFromShop } from "../utils/app-proxy.server";

export const action = async ({ request, params }) => {
  try {
    // Validar el app proxy request (valida la firma)
    await authenticate.public.appProxy(request);
    
    // Obtener el shop del request
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    
    if (!shop) {
      return Response.json({ error: "Shop parameter is required" }, { status: 400 });
    }

    // Obtener el cliente admin desde el shop (aunque no lo usamos aquí, validamos que la app esté instalada)
    const admin = await getAdminFromShop(shop);
    
    if (!admin) {
      return Response.json({ 
        error: "App not installed or session not available. Please authenticate the app first by accessing it from the Shopify admin." 
      }, { status: 401 });
    }

    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const action = params["*"];

    if (action !== "validate") {
      return Response.json({ error: "Action not found" }, { status: 404 });
    }

    const body = await request.json();
    const { dRuc, dTipoRuc } = body;

    if (!dRuc || !dRuc.trim()) {
      return Response.json({ 
        success: false, 
        error: "Por favor, ingrese la cédula o RUC para continuar." 
      }, { status: 400 });
    }

    if (!dTipoRuc || (dTipoRuc !== "1" && dTipoRuc !== "2")) {
      return Response.json({ 
        success: false, 
        error: "Por favor, seleccione el tipo de contribuyente (Natural o Jurídico)." 
      }, { status: 400 });
    }

    const apiKey = process.env.ALUDRA_API_KEY;
    if (!apiKey) {
      console.error("ALUDRA_API_KEY no está configurada");
      return Response.json({ 
        success: false, 
        error: "El servicio de validación no está disponible en este momento. Por favor, intente más tarde." 
      }, { status: 500 });
    }

    const aludraResponse = await fetch('https://apim.aludra.cloud/mdl18/feConsRucDV', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dRuc: dRuc.trim(),
        dTipoRuc: dTipoRuc,
        gCompanyCode: "EMMESA"
      })
    });

    let aludraData;
    try {
      aludraData = await aludraResponse.json();
    } catch (parseError) {
      if (!aludraResponse.ok) {
        return Response.json({ 
          success: false, 
          error: "No se pudo conectar con el servicio de validación. Por favor, intente nuevamente más tarde." 
        }, { status: 500 });
      }
      throw parseError;
    }

    if (!aludraResponse.ok && aludraData) {
      if (aludraData.Status && aludraData.Status.Code === "A400") {
        const errorMsg = aludraData.Status.Message?.dMsgRes || aludraData.Status.Message?.dCodRes || "";
        const isFormatError = errorMsg.includes("Pattern constraint failed") || 
                             errorMsg.includes("invalid according to its datatype") ||
                             errorMsg.includes("element is invalid") ||
                             errorMsg.includes("Fallo de schema XML");
        
        if (isFormatError) {
          return Response.json({
            success: false,
            error: "El formato de la cédula/RUC ingresado no es válido. Por favor, verifique que solo contenga números y guiones según corresponda."
          });
        }
        
        return Response.json({
          success: false,
          error: "El formato de la cédula/RUC ingresado no es válido. Por favor, verifique los datos e intente nuevamente."
        });
      }
      
      return Response.json({ 
        success: false, 
        error: "No se pudo conectar con el servicio de validación. Por favor, intente nuevamente más tarde." 
      }, { status: 500 });
    }

    if (aludraData.Status && aludraData.Status.Code === "200" && aludraData.Data && aludraData.Data.length > 0) {
      const dataItem = aludraData.Data[0];
      
      if (dataItem.gResRucDV && dataItem.gResRucDV.gResProc) {
        const codRes = dataItem.gResRucDV.gResProc.dCodRes;
        
        if (codRes === "0680" && dataItem.gResRucDV.dDV && dataItem.gResRucDV.dNomb) {
          return Response.json({
            success: true,
            data: {
              dDV: dataItem.gResRucDV.dDV,
              dNomb: dataItem.gResRucDV.dNomb
            }
          });
        } else if (codRes === "0640") {
          const hasHyphens = dRuc.includes('-');
          let errorMessage = "Los datos ingresados no figuran como contribuyente inscrito. Por favor, verifique los datos o seleccione otro tipo de cliente.";
          
          if (!hasHyphens) {
            errorMessage += " También verifique que el número incluya los guiones correspondientes.";
          }
          
          return Response.json({
            success: false,
            error: errorMessage
          });
        } else {
          const msgRes = dataItem.gResRucDV.gResProc.dMsgRes || "No se pudo validar el contribuyente. Verifique que la cédula/RUC y el tipo sean correctos.";
          return Response.json({
            success: false,
            error: msgRes === "CONTRIBUYENTE NO INSCRITO" 
              ? "Los datos ingresados no figuran como contribuyente inscrito. Por favor, verifique los datos o seleccione otro tipo de cliente."
              : msgRes
          });
        }
      }
    }

    if (aludraData.Status && aludraData.Status.Code === "A400") {
      const errorMsg = aludraData.Status.Message?.dMsgRes || aludraData.Status.Message?.dCodRes || "";
      const isFormatError = errorMsg.includes("Pattern constraint failed") || 
                           errorMsg.includes("invalid according to its datatype") ||
                           errorMsg.includes("element is invalid") ||
                           errorMsg.includes("Fallo de schema XML");
      
      if (isFormatError) {
        return Response.json({
          success: false,
          error: "El formato de la cédula/RUC ingresado no es válido. Por favor, verifique que solo contenga números y guiones según corresponda."
        });
      }
      
      return Response.json({
        success: false,
        error: "El formato de la cédula/RUC ingresado no es válido. Por favor, verifique los datos e intente nuevamente."
      });
    }

    if (aludraData.errors) {
      return Response.json({
        success: false,
        error: "Los datos enviados no son válidos. Por favor, verifique la información e intente nuevamente."
      }, { status: 400 });
    }

    return Response.json({
      success: false,
      error: "No se pudo validar el contribuyente. Verifique que la cédula/RUC y el tipo sean correctos."
    });

  } catch (error) {
    console.error("Error in contribuyente validation:", error);
    return Response.json(
      { 
        success: false,
        error: "Ocurrió un error al procesar la solicitud. Por favor, intente nuevamente más tarde." 
      },
      { status: 500 }
    );
  }
};
