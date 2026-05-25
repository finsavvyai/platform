// Temporary stub for deployment
export const generatePDF = async (data: any): Promise<Buffer> => {
  return Buffer.from(JSON.stringify(data, null, 2));
};