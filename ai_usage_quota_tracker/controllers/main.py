from odoo import http
from odoo.http import request
import json

class AIUsageController(http.Controller):

    @http.route('/ai_tracker/log_usage', type='json', auth='user', methods=['POST'], csrf=False)
    def log_usage(self, **post):
        """
        Endpoint for Chrome Extension to push token usage data.
        Expected JSON: { 'provider': 'chatgpt', 'model': 'gpt-4', 'tokens': 150 }
        """
        provider = post.get('provider')
        model = post.get('model')
        tokens = post.get('tokens')
        
        if not all([provider, model, tokens]):
            return {'status': 'error', 'message': 'Missing data'}
            
        request.env['ai.usage.log'].sudo().create({
            'provider': provider,
            'model_name': model,
            'tokens_used': int(tokens),
            'user_id': request.env.user.id
        })
        
        return {'status': 'success'}
