from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.lib.units import inch, mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

doc = SimpleDocTemplate(
    "D:/Trabajo/Proyecto2/DIRECTO_Infraestructura_Costos.pdf",
    pagesize=landscape(letter),
    leftMargin=0.6*inch,
    rightMargin=0.6*inch,
    topMargin=0.8*inch,
    bottomMargin=0.8*inch,
)

title_style = ParagraphStyle(
    'Title',
    fontSize=18,
    fontName='Helvetica-Bold',
    textColor=colors.HexColor('#1a1a1a'),
    spaceAfter=6,
    alignment=TA_LEFT,
)

subtitle_style = ParagraphStyle(
    'Subtitle',
    fontSize=10,
    fontName='Helvetica',
    textColor=colors.HexColor('#666666'),
    spaceAfter=20,
    alignment=TA_LEFT,
)

header_style = ParagraphStyle(
    'Header',
    fontSize=9,
    fontName='Helvetica-Bold',
    textColor=colors.HexColor('#333333'),
    alignment=TA_CENTER,
    leading=12,
)

cell_style = ParagraphStyle(
    'Cell',
    fontSize=9,
    fontName='Helvetica',
    textColor=colors.HexColor('#333333'),
    leading=12,
)

cell_center = ParagraphStyle(
    'CellCenter',
    fontSize=9,
    fontName='Helvetica',
    textColor=colors.HexColor('#333333'),
    alignment=TA_CENTER,
    leading=12,
)

cost_style = ParagraphStyle(
    'Cost',
    fontSize=10,
    fontName='Helvetica-Bold',
    textColor=colors.HexColor('#1a1a1a'),
    alignment=TA_RIGHT,
    leading=13,
)

scenario_style = ParagraphStyle(
    'Scenario',
    fontSize=9.5,
    fontName='Helvetica-Bold',
    textColor=colors.HexColor('#1a1a1a'),
    leading=13,
)

infra_style = ParagraphStyle(
    'Infra',
    fontSize=8.5,
    fontName='Helvetica',
    textColor=colors.HexColor('#555555'),
    leading=11.5,
)

note_style = ParagraphStyle(
    'Note',
    fontSize=8,
    fontName='Helvetica',
    textColor=colors.HexColor('#888888'),
    leading=11,
    spaceBefore=12,
)

col_widths = [1.4*inch, 1.05*inch, 1.05*inch, 3.8*inch, 1.9*inch]

headers = [
    Paragraph("Escenario", header_style),
    Paragraph("Usuarios simultáneos aprox.", header_style),
    Paragraph("Usuarios activos/mes", header_style),
    Paragraph("Infraestructura sugerida", header_style),
    Paragraph("Costo mensual desde", header_style),
]

data = [
    headers,
    [
        Paragraph("MVP mínimo / lanzamiento", scenario_style),
        Paragraph("25–50", cell_center),
        Paragraph("1.000–2.000", cell_center),
        Paragraph("1 VPS Contabo (2 vCPU, 4GB RAM) con API, Web y PostgreSQL en el mismo servidor. Google Maps free tier. QR manual para cobros", infra_style),
        Paragraph("US$26/mes", cost_style),
    ],
    [
        Paragraph("Crecimiento", scenario_style),
        Paragraph("50–150", cell_center),
        Paragraph("2.000–10.000", cell_center),
        Paragraph("VPS más robusto (4 vCPU, 8GB RAM), backups automáticos, Google Maps con Places Autocomplete, integración con Libélula para cobros automáticos", infra_style),
        Paragraph("US$51–66/mes", cost_style),
    ],
    [
        Paragraph("Producción inicial", scenario_style),
        Paragraph("150–300", cell_center),
        Paragraph("10.000–30.000", cell_center),
        Paragraph("Servidor dedicado (8 vCPU, 16GB), separación progresiva de servicios, mayor capacidad, backups reforzados y monitoreo", infra_style),
        Paragraph("US$106–150/mes", cost_style),
    ],
    [
        Paragraph("Crecimiento controlado", scenario_style),
        Paragraph("300–500", cell_center),
        Paragraph("20.000–50.000", cell_center),
        Paragraph("Base de datos separada, mayor almacenamiento, más capacidad de tráfico y servicios externos escalados", infra_style),
        Paragraph("US$150–176/mes", cost_style),
    ],
]

table = Table(data, colWidths=col_widths, repeatRows=1)

alt_bg = colors.HexColor('#f9f9f9')
white_bg = colors.HexColor('#ffffff')
header_bg = colors.HexColor('#f0f0f0')
border_color = colors.HexColor('#e0e0e0')
header_border = colors.HexColor('#cccccc')

style = TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), header_bg),
    ('BACKGROUND', (0, 1), (-1, 1), white_bg),
    ('BACKGROUND', (0, 2), (-1, 2), alt_bg),
    ('BACKGROUND', (0, 3), (-1, 3), white_bg),
    ('BACKGROUND', (0, 4), (-1, 4), alt_bg),
    ('GRID', (0, 0), (-1, 0), 0.5, header_border),
    ('LINEBELOW', (0, 0), (-1, 0), 1, header_border),
    ('LINEBELOW', (0, 1), (-1, 1), 0.5, border_color),
    ('LINEBELOW', (0, 2), (-1, 2), 0.5, border_color),
    ('LINEBELOW', (0, 3), (-1, 3), 0.5, border_color),
    ('LINEBELOW', (0, 4), (-1, 4), 0.5, border_color),
    ('LINEBEFORE', (0, 0), (0, -1), 0.5, border_color),
    ('LINEAFTER', (-1, 0), (-1, -1), 0.5, border_color),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('TOPPADDING', (0, 0), (-1, 0), 10),
    ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
    ('TOPPADDING', (0, 1), (-1, -1), 12),
    ('BOTTOMPADDING', (0, 1), (-1, -1), 12),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
])

table.setStyle(style)

story = [
    Paragraph("DIRECTO — Infraestructura y costos por escenario", title_style),
    Paragraph("Proyección de costos según crecimiento de usuarios", subtitle_style),
    table,
    Paragraph("Costos incluyen: VPS, dominio (.com ~$12/año), mantenimiento, Google Maps y Libélula según etapa. SSL gratuito con Let’s Encrypt.", note_style),
]

doc.build(story)
print("PDF generado exitosamente")
