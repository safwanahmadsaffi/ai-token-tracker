from odoo import models, fields, api

class AIQuotaConfig(models.Model):
    _name = 'ai.quota.config'
    _description = 'AI Quota Configuration'

    provider = fields.Selection([
        ('chatgpt', 'ChatGPT'),
        ('claude', 'Claude'),
        ('deepseek', 'DeepSeek'),
        ('gemini', 'Gemini'),
        ('other', 'Other')
    ], string='Provider', required=True)
    
    user_id = fields.Many2one('res.users', string='User (Global if empty)')
    department_id = fields.Many2one('hr.department', string='Department')
    daily_limit = fields.Integer(string='Daily Token Limit', default=50000)
    active = fields.Boolean(default=True)
    
    usage_today = fields.Integer(compute='_compute_usage_today', string='Today\'s Usage')
    percent_used = fields.Float(compute='_compute_usage_today', string='% Used')

    def _compute_usage_today(self):
        for record in self:
            domain = [
                ('provider', '=', record.provider),
                ('date', '=', fields.Date.today())
            ]
            if record.user_id:
                domain.append(('user_id', '=', record.user_id.id))
            
            total = sum(self.env['ai.usage.log'].search(domain).mapped('tokens_used'))
            record.usage_today = total
            record.percent_used = (total / record.daily_limit * 100) if record.daily_limit else 0
