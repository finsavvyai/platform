package billing

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
)

type CheckoutResponse struct {
	Data struct {
		Attributes struct {
			CheckoutURL string `json:"checkout_url"`
		} `json:"attributes"`
	} `json:"data"`
}

func (c *LemonSqueezyClient) GetInvoices(
	filters url.Values,
) ([]map[string]interface{}, error) {
	endpoint := c.baseURL + "/invoices"
	if len(filters) > 0 {
		endpoint += "?" + filters.Encode()
	}
	req, err := c.newRequest("GET", "/invoices", nil)
	if err != nil {
		return nil, err
	}
	if len(filters) > 0 {
		req.URL.RawQuery = filters.Encode()
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode >= http.StatusBadRequest {
		return nil, nil
	}
	var result map[string]interface{}
	json.Unmarshal(body, &result)
	data, ok := result["data"].([]interface{})
	if !ok {
		return []map[string]interface{}{}, nil
	}
	invs := make([]map[string]interface{}, len(data))
	for i, inv := range data {
		invs[i] = inv.(map[string]interface{})
	}
	return invs, nil
}

func (c *LemonSqueezyClient) CreateCheckout(
	variantID, email string,
	customData map[string]string,
) (string, error) {
	return "", nil
}
