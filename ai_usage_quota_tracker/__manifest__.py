{
    'name': 'AI Usage and Quota Tracker',
    'version': '17.0.1.0.0',
    'category': 'Productivity',
    'summary': 'Track daily AI token usage across providers and enforce quotas with alerts.',
    'author': 'Safwan Ahmad Saffi',
    'website': 'https://skysize.io',
    'depends': ['base', 'mail'],
    'data': [
        'security/ir.model.access.csv',
        'data/ir_cron_data.xml',
        'views/ai_usage_views.xml',
        'views/ai_quota_views.xml',
        'views/ai_menus.xml',
    ],
    'installable': True,
    'application': True,
    'license': 'LGPL-3',
}
