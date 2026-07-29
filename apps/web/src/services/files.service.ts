import { apiClient } from './api-client';

export const filesService = {
  async getFileInfo(filePath: string): Promise<{ pageCount: number }> {
    const { data } = await apiClient.get('/files/info', { params: { path: filePath } });
    return data;
  },

  async getThumbnailUrl(filePath: string, page: number): Promise<string> {
    const { data } = await apiClient.get('/files/thumbnail', {
      params: { path: filePath, page },
      responseType: 'blob',
    });
    return URL.createObjectURL(data);
  },

  async getPageUrl(filePath: string, page: number): Promise<string> {
    const { data } = await apiClient.get('/files/page', {
      params: { path: filePath, page },
      responseType: 'blob',
    });
    return URL.createObjectURL(data);
  },

  async downloadFile(filePath: string): Promise<void> {
    const { data } = await apiClient.get('/files/download', {
      params: { path: filePath },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filePath.split('/').pop() || 'document';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
