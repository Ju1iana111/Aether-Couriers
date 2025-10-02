export class AssetLoader {
  public static async loadJSON<T>(url: string): Promise<T> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json() as T;
    } catch (error) {
      console.error(`Failed to load JSON from ${url}:`, error);
      throw error;
    }
  }

  public static async loadText(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      console.error(`Failed to load text from ${url}:`, error);
      throw error;
    }
  }
}
