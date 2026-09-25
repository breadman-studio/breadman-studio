import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET() {
  try {
    // Parsear las credenciales desde la variable de entorno configurada en Vercel
    const credentials = JSON.parse(process.env.GSPAK as string);

    // Configurar la autenticación
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'], // Usa 'https://www.googleapis.com/auth/spreadsheets' si también necesitas escribir datos
    });

    // Inicializar la API de Sheets
    const sheets = google.sheets({ version: 'v4', auth });

    // CRM propio de Campo Capital: "Campo Capital — CRM Leads" (Drive de Fernando).
    // Leído con la cuenta de servicio de Campo Capital (cc-smart, variable GSPAK).
    // Antes apuntaba a la planilla de Claroscuro Records: se separó en sep 2026.
    const spreadsheetId = '17vnEy9bmRLnirkKO19812BUnb8IczDBCGfXYyF3c8IM';
    // Primera pestaña del archivo, columnas A-L
    const range = 'A1:L5000';

    // Leer los datos de la planilla
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    // Enviar los datos de vuelta a tu panel
    return NextResponse.json({ data: response.data.values });
    
  } catch (error) {
    console.error('Error al conectar con Google Sheets:', error);
    return NextResponse.json(
      { error: 'Hubo un error al conectar con la hoja de cálculo' }, 
      { status: 500 }
    );
  }
}
