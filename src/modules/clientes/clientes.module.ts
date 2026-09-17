import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SecurityModule } from "../security/security.module";
import { PropietariosModule } from "../propietarios/propietarios.module";
import { CarterasModule } from "../carteras/carteras.module";
import { ReglasNegociacionIaModule } from "../reglas-negociacion-ia/reglas-negociacion-ia.module";
import { Cartera } from "../carteras/cartera.entity";
import { CarteraConfig } from "../carteras/cartera-config.entity";
import { ClientesController } from "./clientes.controller";
import { ClientesGlobalController } from "./clientes-global.controller";
import { ClienteService } from "./cliente.service";
import { Cliente } from "./cliente.entity";
import { Cuota } from "./cuota.entity";
import { Prestamo } from "./prestamo.entity";
import { PrestamoService } from "./prestamo.service";
import { MoraJobService } from "./mora-job.service";
import { Pago } from "./pago.entity";
import { Abono } from "./abono.entity";
import { PagosService } from "./pagos.service";
import { AbonosService } from "./abonos.service";
import { Visita } from "./visita.entity";
import { PromesaPago } from "./promesa-pago.entity";
import { VisitasService } from "./visitas.service";
import { ClienteEvidencia } from "./cliente-evidencia.entity";
import { CambioClientePendiente } from "./cambio-cliente-pendiente.entity";
import { AuditoriaCartera } from "./auditoria-cartera.entity";
import { CuotaService } from "./cuota.service";
import { ClienteTarjetaService } from "./cliente-tarjeta.service";
import { NavegacionClienteService } from "./navegacion-cliente.service";
import { ColorRiesgoService } from "./color-riesgo.service";
import { ConversacionIa } from "./conversacion-ia.entity";
import { MensajeIa } from "./mensaje-ia.entity";
import { WhatsappSimuladoGateway } from "./whatsapp-simulado.gateway";
import { WHATSAPP_GATEWAY } from "./whatsapp-gateway.interface";
import { NotificacionesService } from "./notificaciones.service";
import { NotificacionesJob } from "./notificaciones-job.service";
import { ConversacionChatService } from "./conversacion-chat.service";
import { EstadoCuentaService } from "./estado-cuenta.service";
import { DetalleCuotaService } from "./detalle-cuota.service";
import { PromesasPagoService } from "./promesas-pago.service";
import { WhatsappSimuladoController } from "./whatsapp-simulado.controller";
import { AsistenteIaService } from "./asistente-ia.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Cliente, Prestamo, Cuota, Pago, Abono, Visita, PromesaPago, ClienteEvidencia, CambioClientePendiente, AuditoriaCartera, ConversacionIa, MensajeIa, Cartera, CarteraConfig]),
    SecurityModule,
    JwtModule.register({}),
    PropietariosModule,
    CarterasModule,
    ReglasNegociacionIaModule,
  ],
  controllers: [ClientesController, ClientesGlobalController, WhatsappSimuladoController],
  providers: [
    ClienteService, PrestamoService, MoraJobService, PagosService, AbonosService, VisitasService, CuotaService, ClienteTarjetaService, NavegacionClienteService,
    ColorRiesgoService,
    WhatsappSimuladoGateway, NotificacionesService, NotificacionesJob, ConversacionChatService, EstadoCuentaService, PromesasPagoService, AsistenteIaService, DetalleCuotaService,
    { provide: WHATSAPP_GATEWAY, useExisting: WhatsappSimuladoGateway },
  ],
  exports: [TypeOrmModule, WHATSAPP_GATEWAY, ClienteService, PrestamoService, PagosService, VisitasService, ClienteTarjetaService, AbonosService, CuotaService, EstadoCuentaService, DetalleCuotaService],
})
export class ClientesModule {}
