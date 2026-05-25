import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;

/**
 * Java Test Client for UDP API on Google Cloud
 * Tests the UDP deployment at http://34.29.39.106/
 */
public class JavaTestClient {
    
    private static final String UDP_BASE_URL = "http://34.29.39.106";
    private static final String HEALTH_ENDPOINT = "/health";
    private static final String ROOT_ENDPOINT = "/";
    
    public static void main(String[] args) {
        System.out.println("🚀 UDP Java Test Client");
        System.out.println("Testing UDP deployment on Google Cloud...\n");
        
        // Test health endpoint
        testHealthEndpoint();
        
        // Test main endpoint
        testMainEndpoint();
        
        // Test connection details
        testConnectionDetails();
    }
    
    /**
     * Test the health endpoint
     */
    private static void testHealthEndpoint() {
        System.out.println("📊 Testing Health Endpoint...");
        try {
            URL url = new URL(UDP_BASE_URL + HEALTH_ENDPOINT);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(10000);
            
            int responseCode = connection.getResponseCode();
            System.out.println("   Status Code: " + responseCode);
            
            if (responseCode == 200) {
                BufferedReader reader = new BufferedReader(
                    new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8)
                );
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    response.append(line);
                }
                reader.close();
                
                System.out.println("   ✅ Health Check: SUCCESS");
                System.out.println("   Response: " + response.toString());
            } else {
                System.out.println("   ❌ Health Check: FAILED");
            }
            
        } catch (Exception e) {
            System.out.println("   ❌ Health Check Error: " + e.getMessage());
        }
        System.out.println();
    }
    
    /**
     * Test the main endpoint
     */
    private static void testMainEndpoint() {
        System.out.println("🌐 Testing Main Endpoint...");
        try {
            URL url = new URL(UDP_BASE_URL + ROOT_ENDPOINT);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(10000);
            
            int responseCode = connection.getResponseCode();
            System.out.println("   Status Code: " + responseCode);
            
            if (responseCode == 200) {
                BufferedReader reader = new BufferedReader(
                    new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8)
                );
                StringBuilder response = new StringBuilder();
                String line;
                int lineCount = 0;
                while ((line = reader.readLine()) != null && lineCount < 5) {
                    response.append(line).append("\n");
                    lineCount++;
                }
                reader.close();
                
                System.out.println("   ✅ Main Page: SUCCESS");
                System.out.println("   Response Preview:");
                System.out.println("   " + response.toString().replace("\n", "\n   "));
            } else {
                System.out.println("   ❌ Main Page: FAILED");
            }
            
        } catch (Exception e) {
            System.out.println("   ❌ Main Page Error: " + e.getMessage());
        }
        System.out.println();
    }
    
    /**
     * Test connection details and performance
     */
    private static void testConnectionDetails() {
        System.out.println("⚡ Testing Connection Performance...");
        try {
            URL url = new URL(UDP_BASE_URL + HEALTH_ENDPOINT);
            
            // Test multiple requests to check performance
            long totalTime = 0;
            int successfulRequests = 0;
            int testRequests = 5;
            
            for (int i = 0; i < testRequests; i++) {
                long startTime = System.currentTimeMillis();
                
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(10000);
                
                int responseCode = connection.getResponseCode();
                long endTime = System.currentTimeMillis();
                long requestTime = endTime - startTime;
                
                if (responseCode == 200) {
                    successfulRequests++;
                    totalTime += requestTime;
                    System.out.println("   Request " + (i + 1) + ": " + requestTime + "ms ✅");
                } else {
                    System.out.println("   Request " + (i + 1) + ": FAILED ❌");
                }
                
                connection.disconnect();
                Thread.sleep(100); // Small delay between requests
            }
            
            if (successfulRequests > 0) {
                double avgTime = (double) totalTime / successfulRequests;
                System.out.println("   📈 Performance Results:");
                System.out.println("   - Successful Requests: " + successfulRequests + "/" + testRequests);
                System.out.println("   - Average Response Time: " + String.format("%.2f", avgTime) + "ms");
                System.out.println("   - Total Time: " + totalTime + "ms");
            }
            
        } catch (Exception e) {
            System.out.println("   ❌ Performance Test Error: " + e.getMessage());
        }
        System.out.println();
    }
}


