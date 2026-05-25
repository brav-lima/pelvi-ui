// Mock para @react-pdf/renderer nos testes e2e.
// O pacote é ESM puro; os testes auth/tenant não exercitam geração de PDF,
// então um stub CJS é suficiente para o módulo carregar sem erro.
const noop = () => null;

module.exports = {
  renderToBuffer: jest.fn().mockResolvedValue(Buffer.alloc(0)),
  renderToStream: jest.fn().mockResolvedValue({ pipe: jest.fn() }),
  Document: noop,
  Page: noop,
  Text: noop,
  View: noop,
  Image: noop,
  Link: noop,
  Note: noop,
  Canvas: noop,
  StyleSheet: { create: (styles) => styles },
  Font: { register: jest.fn(), registerHyphenationCallback: jest.fn() },
  PDFDownloadLink: noop,
  BlobProvider: noop,
  pdf: jest.fn().mockReturnValue({ toBlob: jest.fn(), toBuffer: jest.fn() }),
};
