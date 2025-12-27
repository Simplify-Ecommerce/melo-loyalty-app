import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return null;
};

export default function Index() {
  return (
    <s-page heading="Programa de Lealtad">
      <s-section heading="Bienvenido">
        <s-paragraph>
          Esta aplicación gestiona el programa de lealtad y registro de clientes
          para tu tienda. Los clientes pueden registrarse y completar su
          información de facturación directamente desde el carrito de compras.
        </s-paragraph>
      </s-section>

      <s-section heading="Funcionalidades">
        <s-unordered-list>
          <s-list-item>
            <s-text variant="headingMd">Registro de clientes</s-text>
            <s-paragraph>
              Formulario de registro completo con validación de datos personales,
              información de facturación y segmentación.
            </s-paragraph>
          </s-list-item>
          <s-list-item>
            <s-text variant="headingMd">Facturación personalizada</s-text>
            <s-paragraph>
              Los clientes pueden completar sus datos de facturación con
              validación de contribuyentes mediante API de DGI.
            </s-paragraph>
          </s-list-item>
          <s-list-item>
            <s-text variant="headingMd">Segmentación de clientes</s-text>
            <s-paragraph>
              Sistema de segmentación configurable para categorizar a los
              clientes según sus preferencias o intereses.
            </s-paragraph>
          </s-list-item>
          <s-list-item>
            <s-text variant="headingMd">Metafields personalizados</s-text>
            <s-paragraph>
              Almacenamiento de información adicional del cliente en metafields
              de Shopify sin necesidad de base de datos externa.
            </s-paragraph>
          </s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section slot="aside" heading="Especificaciones técnicas">
        <s-paragraph>
          <s-text>Framework: </s-text>
          <s-link href="https://reactrouter.com/" target="_blank">
            React Router
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>Interface: </s-text>
          <s-link
            href="https://shopify.dev/docs/api/app-home/using-polaris-components"
            target="_blank"
          >
            Polaris web components
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>API: </s-text>
          <s-link
            href="https://shopify.dev/docs/api/admin-graphql"
            target="_blank"
          >
            GraphQL Admin API
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>Almacenamiento: </s-text>
          <s-text>Metafields de Shopify (sin base de datos externa)</s-text>
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="Extensiones del tema">
        <s-paragraph>
          Esta app incluye extensiones del tema que se integran directamente
          en el carrito de compras y en páginas personalizadas:
        </s-paragraph>
        <s-unordered-list>
          <s-list-item>Formulario de factura personalizada (carrito)</s-list-item>
          <s-list-item>Formulario de registro (página personalizada)</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
