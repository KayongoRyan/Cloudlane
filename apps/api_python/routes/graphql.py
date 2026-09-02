"""Legacy thin GraphQL shim — use graphql_app (Strawberry) via main.py."""

from graphql_app import graphql_router as router

__all__ = ['router']
