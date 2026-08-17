from odoo import models, fields, api
from odoo.exceptions import ValidationError

class AIUsageLog(models.Model):
    _name = 'ai.usage.log'
    _description = 'AI Token Usage Log'
    _order = 'date desc, id desc'

    name = fields.Char(string='Reference', readonly=True, default='NEW')
    provider = fields.Selection([
        ('chatgpt', 'ChatGPT'),
        ('claude', 'Claude'),
        ('deepseek', 'DeepSeek'),
        ('gemini', 'Gemini'),
        ('other', 'Other')
    ], string='Provider', required=True)
    
    model_name = fields.Char(string='Model', required=True)
    tokens_used = fields.Integer(string='Tokens', required=True)
    user_id = fields.Many2one('res.users', string='User', required=True, default=lambda self: self.env.user)
    date = fields.Date(string='Date', default=fields.Date.context_today, required=True)

    @api.model
    def create(self, vals):
        if vals.get('name', 'NEW') == 'NEW':
            vals['name'] = self.env['ir.sequence'].next_by_code('ai.usage.log') or 'LOG'
        record = super(AIUsageLog, self).create(vals)
        record._check_and_alert_quota()
        return record

    def _check_and_alert_quota(self):
        for record in self:
            quota = self.env['ai.quota.config'].search([
                ('provider', '=', record.provider),
                ('active', '=', True),
                '|', ('user_id', '=', record.user_id.id), ('user_id', '=', False)
            ], order='user_id desc', limit=1)
            
            if quota:
                total_today = sum(self.search([
                    ('user_id', '=', record.user_id.id),
                    ('provider', '=', record.provider),
                    ('date', '=', record.date)
                ]).mapped('tokens_used'))
                
                percent = (total_today / quota.daily_limit) * 100
                
                if percent >= 80:
                    # Create activity alert
                    self.env['mail.activity'].create({
                        'res_id': record.id,
                        'res_model_id': self.env['ir.model']._get(self._name).id,
                        'activity_type_id': self.env.ref('mail.mail_activity_data_todo').id,
                        'summary': f'Quota Alert: {percent:.1f}% used',
                        'note': f'You have used {total_today} tokens out of your {quota.daily_limit} daily limit for {record.provider}.',
                        'user_id': record.user_id.id,
                    })
                    
    def action_daily_reset(self):
        # Placeholder for scheduled action: In Odoo logs are date-based, 
        # so "reset" usually means archiving or just satisfying the prompt requirement.
        # We could clear logs older than 90 days as mentioned in the extension notes.
        threshold_date = fields.Date.subtract(fields.Date.today(), days=90)
        old_logs = self.search([('date', '<', threshold_date)])
        old_logs.unlink()
