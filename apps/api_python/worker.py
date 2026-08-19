"""Standalone provision worker — processes deployment jobs from Mongo."""

from services.provision_worker import run_worker_loop

if __name__ == '__main__':
    run_worker_loop()
