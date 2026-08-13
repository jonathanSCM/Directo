import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '../src/constants/theme';

const LAST_UPDATED = '12 de agosto de 2026';

interface Section {
  title: string;
  body: string[];
}

const SECTIONS: Section[] = [
  {
    title: '1. Quiénes somos',
    body: [
      'DIRECTO es una plataforma digital (aplicación móvil y sitio web) que conecta a propietarios de inmuebles con personas interesadas en comprar, alquilar o adquirir en anticrético una propiedad en Bolivia, permitiendo el contacto directo entre ambas partes sin intermediarios.',
      'Al crear una cuenta o usar la plataforma, aceptas estos Términos y Condiciones en su totalidad. Si no estás de acuerdo, no debes registrarte ni utilizar el servicio.',
    ],
  },
  {
    title: '2. Qué es (y qué no es) DIRECTO',
    body: [
      'DIRECTO es un tablón de anuncios: publicamos la información que cada propietario carga sobre su inmueble y facilitamos el contacto (llamada o WhatsApp) entre comprador/inquilino y propietario.',
      'DIRECTO no es inmobiliaria, agente inmobiliario, corredor, garante ni parte de ninguna transacción, contrato de compraventa, alquiler o anticrético que se celebre entre usuarios. No verificamos la titularidad legal de los inmuebles ni intervenimos en la negociación, firma de contratos, pagos o entrega de las propiedades publicadas.',
      'Cualquier acuerdo, pago o contrato que resulte del contacto entre usuarios es responsabilidad exclusiva de las partes involucradas. Recomendamos siempre verificar la documentación del inmueble y, ante dudas, asesorarte con un profesional (abogado, notario) antes de firmar o entregar dinero.',
    ],
  },
  {
    title: '3. Cuenta de usuario',
    body: [
      'Para publicar propiedades o contactar propietarios necesitas crear una cuenta con datos reales (nombre, email, teléfono). Sos responsable de mantener la confidencialidad de tu contraseña y de toda actividad realizada desde tu cuenta.',
      'Debes ser mayor de 18 años para registrarte. Nos reservamos el derecho de suspender o cerrar cuentas con información falsa, duplicada o que infrinja estos Términos.',
    ],
  },
  {
    title: '4. Publicación de propiedades',
    body: [
      'Si publicas un inmueble, declaras que la información (precio, ubicación, fotos, descripción, disponibilidad) es veraz y que contás con la facultad legal para ofrecerlo en venta, alquiler o anticrético.',
      'Está prohibido publicar propiedades que no existen, que no te pertenecen sin autorización del propietario, o contenido fraudulento, engañoso, discriminatorio, o que infrinja derechos de terceros.',
      'Toda publicación queda sujeta a revisión y aprobación por el equipo de DIRECTO, y puede ser rechazada, pausada o eliminada si incumple estos Términos, sin perjuicio de otras medidas.',
      'Publicar propiedades puede requerir una suscripción activa o el uso de la prueba gratuita disponible, según los planes vigentes en la app.',
    ],
  },
  {
    title: '5. Suscripciones y pagos',
    body: [
      'Algunos planes de publicación tienen costo, indicado en la app en bolivianos (BOB) antes de contratarlos. El pago se procesa mediante los métodos habilitados (actualmente, QR).',
      'Las suscripciones se activan una vez confirmado el pago y tienen la duración indicada en el plan contratado. No garantizamos reembolsos salvo que la ley boliviana lo exija o que exista un error atribuible a DIRECTO.',
    ],
  },
  {
    title: '6. Conducta de los usuarios',
    body: [
      'Al usar DIRECTO te comprometés a: no publicar contenido ilegal, ofensivo, difamatorio o que viole derechos de terceros; no usar la plataforma para fines distintos a buscar o publicar inmuebles; no intentar vulnerar la seguridad de la app o extraer datos de forma masiva (scraping); y a tratar a otros usuarios con respeto en cualquier comunicación.',
      'Podemos suspender o eliminar cuentas que incumplan lo anterior, con o sin aviso previo, según la gravedad de la infracción.',
    ],
  },
  {
    title: '7. Propiedad intelectual',
    body: [
      'La marca DIRECTO, el logo, el diseño de la app y su código son propiedad de DIRECTO o de sus licenciantes. El contenido que publicás (fotos, descripciones) sigue siendo tuyo, pero nos otorgás una licencia para mostrarlo dentro de la plataforma con el fin de operar el servicio.',
    ],
  },
  {
    title: '8. Limitación de responsabilidad',
    body: [
      'DIRECTO se ofrece "tal cual está". No garantizamos disponibilidad ininterrumpida del servicio, ni la exactitud de la información publicada por terceros, ni el resultado de ninguna negociación entre usuarios.',
      'En la máxima medida permitida por la ley boliviana, DIRECTO no será responsable por daños directos o indirectos derivados del uso de la plataforma, de transacciones entre usuarios, o de información incorrecta publicada por terceros.',
    ],
  },
  {
    title: '9. Privacidad',
    body: [
      'El tratamiento de tus datos personales (nombre, email, teléfono, ubicación) se rige por nuestra Política de Privacidad. Usamos esta información para operar el servicio, facilitar el contacto entre usuarios y cumplir obligaciones legales.',
    ],
  },
  {
    title: '10. Cambios a estos términos',
    body: [
      'Podemos actualizar estos Términos y Condiciones para reflejar cambios en el servicio o en la normativa aplicable. Publicaremos la versión vigente en la app con la fecha de última actualización. El uso continuado de DIRECTO después de un cambio implica su aceptación.',
    ],
  },
  {
    title: '11. Ley aplicable y contacto',
    body: [
      'Estos Términos se rigen por las leyes del Estado Plurinacional de Bolivia. Cualquier controversia se someterá a los tribunales competentes en Bolivia.',
      'Para consultas sobre estos Términos, podés contactarnos a través del soporte disponible dentro de la app.',
    ],
  },
];

export default function TermsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/register'))}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Términos y Condiciones</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>Última actualización: {LAST_UPDATED}</Text>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.body.map((paragraph, i) => (
              <Text key={i} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}

        <Text style={styles.footerNote}>
          Al registrarte en DIRECTO confirmás que leíste y aceptás estos Términos y Condiciones.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '800',
    color: Colors.gray[900],
  },
  scroll: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: 48,
  },
  updated: {
    fontSize: Fonts.sizes.sm,
    color: Colors.gray[400],
    marginBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Fonts.sizes.md,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: Spacing.sm,
  },
  paragraph: {
    fontSize: Fonts.sizes.sm,
    color: Colors.gray[600],
    lineHeight: 21,
    marginBottom: Spacing.sm,
  },
  footerNote: {
    fontSize: Fonts.sizes.sm,
    color: Colors.gray[500],
    fontStyle: 'italic',
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
    paddingTop: Spacing.lg,
  },
});
