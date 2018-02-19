package com.prisma.prod

import akka.actor.ActorSystem
import akka.stream.ActorMaterializer
import com.prisma.akkautil.http.ServerExecutor
import com.prisma.api.server.ApiServer
import com.prisma.deploy.server.ClusterServer
import com.prisma.subscriptions.SimpleSubscriptionsServer
import com.prisma.websocket.WebsocketServer
import com.prisma.workers.WorkerServer
import com.prisma.utils.boolean.BooleanUtils._

object PrismaProdMain {
  implicit val system       = ActorSystem("single-server")
  implicit val materializer = ActorMaterializer()
  implicit val dependencies = PrismaProdDependencies()
  val port                  = sys.env.getOrElse("PORT", "9000").toInt

  // TODO: add if for inclusion of cluster server
  val includeClusterServer = sys.env.get("CLUSTER_API_ENABLED").contains("1")

  val servers = List(
    ApiServer(dependencies.apiSchemaBuilder),
    WebsocketServer(dependencies),
    SimpleSubscriptionsServer(),
    WorkerServer(dependencies)
  ) ++
    includeClusterServer.toOption(ClusterServer("cluster"))

  ServerExecutor(
    port = port,
    servers = servers: _*
  ).startBlocking()
}
