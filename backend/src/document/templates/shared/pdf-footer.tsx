import { View, Text } from '@react-pdf/renderer';
import { styles } from './pdf-styles';

interface Props {
  professional?: string;
  generatedAt: string;
}

export function PdfFooter({ professional, generatedAt }: Props) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        Gerado em {generatedAt}
        {professional ? ` por ${professional}` : ''}
      </Text>
    </View>
  );
}
