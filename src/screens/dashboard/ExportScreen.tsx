import React, { useState } from 'react';
import { View, StyleSheet, Text, ScrollView, Switch, ActivityIndicator, Platform, useWindowDimensions, TextInput, TouchableOpacity, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useApp } from '../../context/AppContext';
import { usePDFGenerator } from '../../hooks/usePDFGenerator';
import { useToast } from '../../components/ui/Toast';
import { generateId, formatFileSize } from '../../utils/helpers';

export const ExportScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { currentProject, scannedPages, loadScannedPages } = useApp();
  const { isGenerating, progress, error, generatePDF, compressPDF, sharePDF } = usePDFGenerator();
  const { showToast } = useToast();
  const { width: windowWidth } = useWindowDimensions();

  const isLargeScreen = Platform.OS === 'web' && windowWidth > 768;

  // Layout States
  const [pageSize, setPageSize] = useState<'A4' | 'Letter' | 'Legal'>('A4');
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [margin, setMargin] = useState<number>(0.5);
  const [includeMetadata, setIncludeMetadata] = useState(true);

  // Settings States
  const [exportFormat, setExportFormat] = useState<'pdf' | 'jpg' | 'png' | 'docx'>('pdf');
  const [watermark, setWatermark] = useState('');
  const [password, setPassword] = useState('');
  const [encryptPdf, setEncryptPdf] = useState(false);

  // Compress PDF States
  const [compressLevel, setCompressLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [compressResult, setCompressResult] = useState<{ size: number; savedBytes: number } | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  // Success view states
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportedFileUri, setExportedFileUri] = useState('');
  const [exportedFileSize, setExportedFileSize] = useState(0);

  const projectPages = scannedPages.filter(p => p.projectId === currentProject?.id);

  const handleExport = async () => {
    if (projectPages.length === 0) {
      showToast('No pages to export', 'error');
      return;
    }

    if (exportFormat === 'pdf') {
      const options = {
        pageSize,
        quality,
        margin,
        includeMetadata,
        watermarkText: watermark || undefined,
        password: encryptPdf && password ? password : undefined,
      };

      const result = await generatePDF(projectPages, options);
      if (result) {
        setExportedFileUri(result.uri);
        setExportedFileSize(result.size);
        setExportSuccess(true);
        showToast(encryptPdf ? 'PDF generated with password protection!' : 'PDF exported successfully!', 'success');
      } else {
        showToast(error || 'Failed to export PDF', 'error');
      }
    } else {
      // Export JPG, PNG or DOCX
      try {
        if (Platform.OS === 'web') {
          if (exportFormat === 'jpg' || exportFormat === 'png') {
            // Trigger browser downloads for image pages
            projectPages.forEach((page, index) => {
              const link = document.createElement('a');
              link.href = page.processedUri || page.imageUri || page.originalUri;
              link.download = `${currentProject?.title || 'scan'}_page_${index + 1}.${exportFormat}`;
              link.click();
            });
            setExportedFileSize(projectPages.length * 150000); // Approximate size
          } else if (exportFormat === 'docx') {
            // DOCX format HTML download
            const docxContent = `
              <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
              <body>
                <h2>${currentProject?.title}</h2>
                <p>Total Scanned Pages: ${projectPages.length}</p>
                ${projectPages.map((page, idx) => `<p>Page ${idx + 1}</p><img src="${page.processedUri || page.imageUri}" width="500"/><hr/>`).join('')}
              </body>
              </html>
            `;
            const blob = new Blob([docxContent], { type: 'application/msword' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${currentProject?.title || 'document'}.docx`;
            link.click();
            setExportedFileUri(url);
            setExportedFileSize(blob.size);
          }
          setExportSuccess(true);
        } else {
          showToast('Format exported successfully', 'success');
        }
      } catch (err) {
        console.error(err);
        showToast('Export failed', 'error');
      }
    }
  };

  // Compress PDF Handler
  const handleCompress = async () => {
    if (projectPages.length === 0) {
      showToast('No pages to compress', 'error');
      return;
    }
    setIsCompressing(true);
    try {
      const result = await compressPDF(
        projectPages,
        { pageSize, quality, margin, includeMetadata },
        compressLevel
      );
      if (result) {
        setCompressResult({ size: result.size, savedBytes: result.savedBytes });
        showToast(`Compressed! Saved ~${formatFileSize(result.savedBytes)}`, 'success');
      } else {
        showToast('Compression failed', 'error');
      }
    } catch (e) { console.error(e); showToast('Compression error', 'error'); }
    setIsCompressing(false);
  };

  const handleShareToWhatsApp = () => {
    const textMessage = `Check out my document "${currentProject?.title || 'Scan'}" exported as ${exportFormat.toUpperCase()}!`;
    const encodedText = encodeURIComponent(textMessage);
    
    if (Platform.OS === 'web') {
      // Open WhatsApp web link
      const whatsappWebUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
      window.open(whatsappWebUrl, '_blank');
      showToast('Redirected to WhatsApp Web! Drag and drop the downloaded file into the chat.', 'info');
    } else {
      // Native WhatsApp scheme opening
      const nativeWhatsappUrl = `whatsapp://send?text=${encodedText}`;
      Linking.canOpenURL(nativeWhatsappUrl).then(supported => {
        if (supported) {
          Linking.openURL(nativeWhatsappUrl);
        } else {
          // Fallback to native share sheet
          if (exportedFileUri) sharePDF(exportedFileUri);
        }
      });
    }
  };

  const handleNativeShare = () => {
    if (Platform.OS !== 'web' && exportedFileUri) {
      sharePDF(exportedFileUri);
    } else {
      // Web fallback
      navigator.clipboard.writeText(window.location.href);
      showToast('App link copied to clipboard!', 'success');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, isLargeScreen && styles.largeContent]}>
        <Button variant="ghost" size="sm" onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={Theme.colors.text.secondary} />
        </Button>
        <Text style={styles.headerTitle}>
          {exportSuccess ? 'Export Ready' : 'Export Document'}
        </Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, isLargeScreen && styles.largeContent]}
        showsVerticalScrollIndicator={false}
      >
        {isGenerating ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Theme.colors.ocean[500]} />
            <Text style={styles.loadingText}>Generating document...</Text>
            <Text style={styles.progressText}>{Math.round(progress)}% Complete</Text>
          </View>
        ) : exportSuccess ? (
          // SUCCESS PANEL WITH WHATSAPP SHARING
          <View style={styles.successContainer}>
            <View style={styles.successIconBg}>
              <Ionicons name="checkmark-done-circle" size={80} color={Theme.colors.status.success} />
            </View>
            <Text style={styles.successTitle}>Export Completed!</Text>
            <Text style={styles.successSub}>
              {currentProject?.title} has been exported and downloaded.
            </Text>

            <Card style={styles.fileSummaryCard} padding="md">
              <View style={styles.fileSummaryRow}>
                <Ionicons
                  name={exportFormat === 'pdf' ? 'document-text' : exportFormat === 'docx' ? 'document' : 'image'}
                  size={36}
                  color={Theme.colors.ocean[500]}
                />
                <View style={{ marginLeft: Theme.spacing.sm, flex: 1 }}>
                  <Text style={styles.summaryFileName} numberOfLines={1}>
                    {currentProject?.title}.{exportFormat}
                  </Text>
                  <Text style={styles.summaryFileSize}>
                    {exportedFileSize ? formatFileSize(exportedFileSize) : 'Unknown size'} • {projectPages.length} pages
                  </Text>
                </View>
              </View>
            </Card>

            <Text style={styles.shareInstructions}>Share your document directly:</Text>

            {/* Sharing buttons */}
            <View style={styles.shareActionsCol}>
              {/* WhatsApp Button */}
              <TouchableOpacity style={styles.whatsappBtn} onPress={handleShareToWhatsApp}>
                <Ionicons name="logo-whatsapp" size={24} color="#FFF" />
                <Text style={styles.whatsappBtnText}>Share to WhatsApp</Text>
              </TouchableOpacity>

              {/* Native / General share */}
              <Button
                variant="outline"
                size="lg"
                fullWidth
                onPress={handleNativeShare}
                leftIcon={<Ionicons name="share-social-outline" size={22} color={Theme.colors.ocean[500]} />}
              >
                {Platform.OS === 'web' ? 'Copy App Link' : 'Share Document'}
              </Button>

              <Button
                size="lg"
                fullWidth
                style={{ marginTop: Theme.spacing.md }}
                onPress={() => navigation.goBack()}
              >
                Back to Document
              </Button>
            </View>
          </View>
        ) : (
          // SETTINGS PANEL
          <>
            <Card style={styles.sectionCard} padding="lg">
              <Text style={styles.sectionTitle}>Document Details</Text>
              <Text style={styles.detailText}>
                Title: <Text style={{ fontWeight: 'bold' }}>{currentProject?.title}</Text>
              </Text>
              <Text style={styles.detailText}>
                Total Pages: <Text style={{ fontWeight: 'bold' }}>{projectPages.length}</Text>
              </Text>
            </Card>

            <Card style={styles.sectionCard} padding="lg">
              <Text style={styles.sectionTitle}>Export Format</Text>
              <View style={styles.formatGrid}>
                {(['pdf', 'jpg', 'png', 'docx'] as const).map(fmt => (
                  <TouchableOpacity
                    key={fmt}
                    style={[
                      styles.formatCardBtn,
                      exportFormat === fmt && styles.formatCardBtnActive,
                    ]}
                    onPress={() => setExportFormat(fmt)}
                  >
                    <Ionicons
                      name={
                        fmt === 'pdf' ? 'document-text' :
                        fmt === 'docx' ? 'document' : 'image'
                      }
                      size={24}
                      color={exportFormat === fmt ? Theme.colors.ocean[500] : Theme.colors.text.secondary}
                    />
                    <Text style={[styles.formatText, exportFormat === fmt && styles.formatTextActive]}>
                      {fmt.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>

            {exportFormat === 'pdf' && (
              <Card style={styles.settingsCard} padding="lg">
                <Text style={styles.sectionTitle}>PDF Layout Options</Text>

                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Page Size</Text>
                  <View style={styles.optionsWrapper}>
                    {(['A4', 'Letter', 'Legal'] as const).map(size => (
                      <TouchableOpacity
                        key={size}
                        style={[
                          styles.optionBtn,
                          pageSize === size && styles.optionBtnActive,
                        ]}
                        onPress={() => setPageSize(size)}
                      >
                        <Text style={[styles.optionText, pageSize === size && styles.optionTextActive]}>
                          {size}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Image Compression Quality</Text>
                  <View style={styles.optionsWrapper}>
                    {(['low', 'medium', 'high'] as const).map(q => (
                      <TouchableOpacity
                        key={q}
                        style={[
                          styles.optionBtn,
                          quality === q && styles.optionBtnActive,
                        ]}
                        onPress={() => setQuality(q)}
                      >
                        <Text style={[styles.optionText, quality === q && styles.optionTextActive]}>
                          {q.charAt(0).toUpperCase() + q.slice(1)} (Compress)
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Page Margins</Text>
                  <View style={styles.optionsWrapper}>
                    {([0, 0.25, 0.5] as const).map(m => (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.optionBtn,
                          margin === m && styles.optionBtnActive,
                        ]}
                        onPress={() => setMargin(m)}
                      >
                        <Text style={[styles.optionText, margin === m && styles.optionTextActive]}>
                          {m === 0 ? 'None' : `${m}"`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.toggleRow}>
                  <View>
                    <Text style={styles.settingLabel}>Include Metadata</Text>
                    <Text style={styles.settingDesc}>Add page numbers and creation date.</Text>
                  </View>
                  <Switch
                    value={includeMetadata}
                    onValueChange={setIncludeMetadata}
                    trackColor={{ false: '#D1D1D6', true: Theme.colors.ocean[500] }}
                  />
                </View>
              </Card>
            )}

            <Card style={styles.settingsCard} padding="lg">
              <Text style={styles.sectionTitle}>Security & Annotation</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.settingLabel}>Document Watermark</Text>
                <TextInput
                  placeholder="Draft / Confidential / Company Name"
                  value={watermark}
                  onChangeText={setWatermark}
                  style={styles.textInput}
                  placeholderTextColor={Theme.colors.text.muted}
                />
              </View>

              {exportFormat === 'pdf' && (
                <View style={[styles.toggleRow, { marginTop: Theme.spacing.lg, paddingTop: Theme.spacing.md, borderTopWidth: 1, borderTopColor: Theme.colors.border.light }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingLabel}>Password Protect PDF</Text>
                    <Text style={styles.settingDesc}>Encrypt file with secure password.</Text>
                  </View>
                  <Switch
                    value={encryptPdf}
                    onValueChange={setEncryptPdf}
                    trackColor={{ false: '#D1D1D6', true: Theme.colors.ocean[500] }}
                  />
                </View>
              )}

              {encryptPdf && exportFormat === 'pdf' && (
                <View style={[styles.inputContainer, { marginTop: Theme.spacing.md }]}>
                  <Text style={styles.settingLabel}>File Password</Text>
                  <TextInput
                    placeholder="Enter file password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    style={styles.textInput}
                    placeholderTextColor={Theme.colors.text.muted}
                  />
                </View>
              )}
            </Card>

            {/* Compress PDF Card */}
            {exportFormat === 'pdf' && (
              <Card style={styles.settingsCard} padding="lg">
                <View style={styles.compressHeader}>
                  <View style={[styles.compressIconBg, { backgroundColor: `${Theme.colors.accent.teal}15` }]}>
                    <Ionicons name="layers-outline" size={20} color={Theme.colors.accent.teal} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionTitle}>Compress PDF</Text>
                    <Text style={styles.settingDesc}>Reduce file size by lowering image resolution.</Text>
                  </View>
                </View>

                <View style={[styles.optionsWrapper, { marginTop: Theme.spacing.md }]}>
                  {(['low', 'medium', 'high'] as const).map(lvl => (
                    <TouchableOpacity
                      key={lvl}
                      style={[
                        styles.optionBtn,
                        compressLevel === lvl && { ...styles.optionBtnActive, backgroundColor: `${Theme.colors.accent.teal}15`, borderColor: Theme.colors.accent.teal },
                      ]}
                      onPress={() => setCompressLevel(lvl)}
                    >
                      <Text style={[
                        styles.optionText,
                        compressLevel === lvl && { color: Theme.colors.accent.teal, fontFamily: Theme.typography.fontFamilies.bold },
                      ]}>
                        {lvl === 'low' ? '🔵 Low' : lvl === 'medium' ? '🟠 Medium' : '🔴 High'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.compressInfo}>
                  <Ionicons name="information-circle-outline" size={14} color={Theme.colors.text.muted} />
                  <Text style={styles.compressInfoText}>
                    {compressLevel === 'low' ? 'Low: ~15–25% smaller, minimal quality loss'
                      : compressLevel === 'medium' ? 'Medium: ~40–55% smaller, good quality balance'
                      : 'High: ~60–75% smaller, visible quality reduction'}
                  </Text>
                </View>

                {compressResult && (
                  <View style={styles.compressResultRow}>
                    <Ionicons name="checkmark-circle" size={16} color={Theme.colors.status.success} />
                    <Text style={styles.compressResultText}>
                      Last compressed: {formatFileSize(compressResult.size)}
                      {compressResult.savedBytes > 0 ? ` · saved ~${formatFileSize(compressResult.savedBytes)}` : ''}
                    </Text>
                  </View>
                )}

                <Button
                  variant="outline"
                  size="md"
                  fullWidth
                  style={{ marginTop: Theme.spacing.md, borderColor: Theme.colors.accent.teal }}
                  onPress={handleCompress}
                  disabled={isCompressing || isGenerating}
                >
                  {isCompressing
                    ? <ActivityIndicator size="small" color={Theme.colors.accent.teal} />
                    : <><Ionicons name="layers-outline" size={18} color={Theme.colors.accent.teal} style={{ marginRight: 6 }} />
                       <Text style={{ color: Theme.colors.accent.teal, fontFamily: Theme.typography.fontFamilies.semiBold }}>Compress & Download</Text></>
                  }
                </Button>
              </Card>
            )}

            <Button
              size="lg"
              fullWidth
              onPress={handleExport}
              style={{ marginTop: Theme.spacing.xl }}
              leftIcon={<Ionicons name="share-outline" size={24} color={Theme.colors.text.inverse} />}
            >
              Export & Download
            </Button>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.surface.primary,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.md,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border.light,
  },
  backButton: {
    padding: Theme.spacing.xs,
  },
  headerTitle: {
    ...Theme.textStyles.h3,
  },
  scrollContent: {
    padding: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xxl,
  },
  largeContent: {
    maxWidth: 700,
    alignSelf: 'center',
    paddingHorizontal: 0,
  },
  compressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.xs,
  },
  compressIconBg: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  compressInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.xs,
    marginTop: Theme.spacing.sm,
    backgroundColor: Theme.colors.surface.tertiary,
    borderRadius: Theme.borderRadius.sm,
    padding: Theme.spacing.sm,
  },
  compressInfoText: {
    ...Theme.textStyles.caption,
    color: Theme.colors.text.secondary,
    flex: 1,
  },
  compressResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    marginTop: Theme.spacing.sm,
  },
  compressResultText: {
    ...Theme.textStyles.caption,
    color: Theme.colors.status.success,
    fontFamily: Theme.typography.fontFamilies.medium,
  },
  sectionCard: {
    marginBottom: Theme.spacing.lg,
  },
  sectionTitle: {
    ...Theme.textStyles.h3,
    marginBottom: Theme.spacing.md,
  },
  detailText: {
    ...Theme.textStyles.body,
    color: Theme.colors.text.secondary,
    marginBottom: Theme.spacing.xs,
  },
  formatGrid: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  formatCardBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Theme.colors.border.light,
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.surface.primary,
    gap: 4,
  },
  formatCardBtnActive: {
    borderColor: Theme.colors.ocean[500],
    backgroundColor: Theme.colors.ocean[50],
  },
  formatText: {
    fontSize: 11,
    color: Theme.colors.text.secondary,
    fontFamily: Theme.typography.fontFamilies.bold,
  },
  formatTextActive: {
    color: Theme.colors.ocean[500],
  },
  settingsCard: {
    marginBottom: Theme.spacing.md,
  },
  settingRow: {
    marginBottom: Theme.spacing.lg,
  },
  settingLabel: {
    ...Theme.textStyles.body,
    fontFamily: Theme.typography.fontFamilies.semiBold,
    marginBottom: Theme.spacing.sm,
  },
  settingDesc: {
    ...Theme.textStyles.caption,
    color: Theme.colors.text.secondary,
  },
  optionsWrapper: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  optionBtn: {
    flex: 1,
    paddingVertical: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Theme.colors.border.light,
    borderRadius: Theme.borderRadius.sm,
    alignItems: 'center',
    backgroundColor: Theme.colors.surface.primary,
  },
  optionBtnActive: {
    borderColor: Theme.colors.ocean[500],
    backgroundColor: Theme.colors.ocean[50],
  },
  optionText: {
    fontSize: 11,
    color: Theme.colors.text.secondary,
    fontFamily: Theme.typography.fontFamilies.medium,
    textAlign: 'center',
  },
  optionTextActive: {
    color: Theme.colors.ocean[500],
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border.light,
    paddingTop: Theme.spacing.lg,
    marginTop: Theme.spacing.sm,
  },
  inputContainer: {
    width: '100%',
  },
  textInput: {
    height: 48,
    borderWidth: 1,
    borderColor: Theme.colors.border.light,
    borderRadius: Theme.borderRadius.sm,
    paddingHorizontal: Theme.spacing.md,
    backgroundColor: Theme.colors.surface.primary,
    ...Theme.textStyles.body,
    color: Theme.colors.text.primary,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  loadingText: {
    ...Theme.textStyles.h3,
    marginTop: Theme.spacing.lg,
  },
  progressText: {
    ...Theme.textStyles.body,
    color: Theme.colors.text.secondary,
    marginTop: Theme.spacing.xs,
  },
  // Success Container styles
  successContainer: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.md,
  },
  successIconBg: {
    marginBottom: Theme.spacing.md,
  },
  successTitle: {
    ...Theme.textStyles.h1,
    color: Theme.colors.status.success,
    marginBottom: Theme.spacing.xs,
  },
  successSub: {
    ...Theme.textStyles.bodyLarge,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: Theme.spacing.xl,
  },
  fileSummaryCard: {
    width: '100%',
    backgroundColor: Theme.colors.surface.secondary,
    borderColor: Theme.colors.border.light,
    marginBottom: Theme.spacing.xl,
  },
  fileSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryFileName: {
    ...Theme.textStyles.body,
    fontFamily: Theme.typography.fontFamilies.bold,
  },
  summaryFileSize: {
    ...Theme.textStyles.caption,
    color: Theme.colors.text.secondary,
    marginTop: 2,
  },
  shareInstructions: {
    ...Theme.textStyles.bodySmall,
    fontFamily: Theme.typography.fontFamilies.bold,
    color: Theme.colors.text.tertiary,
    alignSelf: 'flex-start',
    marginBottom: Theme.spacing.sm,
  },
  shareActionsCol: {
    width: '100%',
    gap: Theme.spacing.md,
  },
  whatsappBtn: {
    flexDirection: 'row',
    backgroundColor: '#25D366', // Brand WhatsApp green
    height: 50,
    borderRadius: Theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Theme.shadows.sm,
  },
  whatsappBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: Theme.typography.fontFamilies.bold,
  },
});
