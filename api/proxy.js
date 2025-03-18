const https = require('https');

module.exports = async (req, res) => {
    const CMC_API_KEY = '39f838a8-b264-4fdc-87d9-97d8fadc5361';
    
    const options = {
        hostname: 'pro-api.coinmarketcap.com',
        path: '/v2/cryptocurrency/quotes/latest?id=5994&convert=USD',
        method: 'GET',
        headers: {
            'X-CMC_PRO_API_KEY': CMC_API_KEY,
            'Accept': 'application/json'
        }
    };

    try {
        const cmc_response = await new Promise((resolve, reject) => {
            const req = https.get(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => { resolve(data); });
            });
            req.on('error', reject);
        });

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Cache-Control', 'no-cache');
        res.status(200).json(JSON.parse(cmc_response));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch data' });
    }
};