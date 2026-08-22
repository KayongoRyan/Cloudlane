import os
import sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
api_dir = os.path.join(root, 'apps', 'api_python')
os.chdir(api_dir)
sys.path.insert(0, api_dir)

import database as db

db.get_db()
r = db.col('provision_jobs').update_many(
    {'status': 'processing'},
    {'$set': {'status': 'queued'}},
)
print('reset', r.modified_count)
