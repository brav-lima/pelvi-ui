import { View, Text } from '@react-pdf/renderer';
import { styles } from './pdf-styles';

interface Props {
  org: { name: string; document?: string | null };
  title: string;
}

export function PdfHeader({ org, title }: Props) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerOrg}>{org.name}</Text>
      {org.document && (
        <Text style={styles.headerMeta}>CNPJ: {org.document}</Text>
      )}
      <Text style={styles.headerDocument}>{title}</Text>
    </View>
  );
}
