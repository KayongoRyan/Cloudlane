from __future__ import annotations

import time

import database as db
from config import get_settings
from services.provisioner import provision_deployment


def process_job(job: dict) -> None:
    settings = get_settings()
    job_id = job['id']
    deployment_id = job['deploymentId']
    tenant_id = job['tenantId']

    try:
        db.update_deployment_status(deployment_id, 'provisioning', 'Worker is provisioning resources')
        provision_deployment(job)
        db.complete_provision_job(job_id, 'succeeded')
        deployment = db.find_deployment_by_id(deployment_id, tenant_id)
        if deployment and deployment.get('status') == 'running' and deployment.get('publicUrl'):
            try:
                from services.lb_config import sync_lb_configs
                sync_lb_configs()
            except Exception as sync_exc:
                print(f'lb config sync after provision failed: {sync_exc}')
        db.write_audit_log({
            'tenantId': tenant_id,
            'userId': None,
            'action': 'deployment.provision.succeeded',
            'resourceType': 'deployment',
            'resourceId': deployment_id,
            'changes': {'jobId': job_id},
        })
    except Exception as exc:
        error = str(exc)
        attempts = job.get('attempts', 1)
        if attempts < settings.provision_max_attempts:
            db.requeue_provision_job(job_id, error)
            db.update_deployment_status(
                deployment_id,
                'provisioning',
                f'Provision attempt {attempts} failed — retrying',
            )
            print(f'provision job {job_id} failed (attempt {attempts}), requeued: {error}')
            return

        db.complete_provision_job(job_id, 'failed', error)
        db.update_deployment_status(deployment_id, 'failed', error)
        db.write_audit_log({
            'tenantId': tenant_id,
            'userId': None,
            'action': 'deployment.provision.failed',
            'resourceType': 'deployment',
            'resourceId': deployment_id,
            'changes': {'jobId': job_id, 'error': error},
        })
        print(f'provision job {job_id} failed permanently: {error}')


def run_worker_loop() -> None:
    settings = get_settings()
    try:
        db.ensure_indexes()
    except Exception as exc:
        print(f'ensure_indexes warning: {exc}')
    print(f'Provision worker started (poll={settings.worker_poll_interval_seconds}s)')
    while True:
        job = db.claim_next_provision_job()
        if job:
            process_job(job)
        else:
            time.sleep(settings.worker_poll_interval_seconds)
