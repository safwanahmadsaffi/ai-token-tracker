from odoo import http
from odoo.http import request
import json

class AIUsageController(http.Controller):

    @http.route('/ai_tracker/log_usage', type='http', auth='public', methods=['OPTIONS'], cors='*', csrf=False)
    def log_usage_options(self, **kw):
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        }
        return request.make_response('', headers=headers)

    @http.route('/ai_tracker/log_usage', type='json', auth='public', methods=['POST'], cors='*', csrf=False)
    def log_usage(self, **post):
        """
        Endpoint for Chrome Extension to push token usage data.
        Expected JSON: { 'provider': 'chatgpt', 'model': 'gpt-4', 'tokens': 150 }
        """
        provider = post.get('provider')
        model = post.get('model')
        tokens = post.get('tokens')
        
        if not all([provider, model, tokens]):
            return {'status': 'error', 'message': 'Missing required fields'}
            
        # Use active logged-in user or fallback to admin user for public API posts
        user = request.env.user if (request.env.user and request.env.user.id != request.env.ref('base.public_user').id) else request.env['res.users'].sudo().search([], limit=1)

        request.env['ai.usage.log'].sudo().create({
            'provider': provider,
            'model_name': model,
            'tokens_used': int(tokens),
            'user_id': user.id if user else 1
        })
        
        return {'status': 'success'}
