import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CarteraModule } from "../cartera/cartera.module";
import { CobradoresModule } from "../cobradores/cobradores.module";
import { Ruta } from "../rutas/ruta.entity";
import { RutasModule } from "../rutas/rutas.module";
import { SecurityModule } from "../security/security.module";
import { SociosModule } from "../socios/socios.module";
import { AplicarEventosOfflineService } from "./aplicar-eventos-offline.service";
import { AplicarOfflineJob } from "./aplicar-offline-job.service";
import { DeviceApiKeyGuard } from "./device-api-key.guard";
import { Device } from "./device.entity";
import { DevicesService } from "./devices.service";
import { EvidenciasOfflineService } from "./evidencias-offline.service";
import { SincronizacionOffline } from "./sincronizacion-offline.entity";
import { SincronizacionOfflineController } from "./sincronizacion-offline.controller";
import { SincronizacionOfflineService } from "./sincronizacion-offline.service";
import { SnapshotDiaService } from "./snapshot-dia.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Device, SincronizacionOffline, Ruta]),
    SecurityModule,
    JwtModule.register({}),
    RutasModule,
    SociosModule,
    CarteraModule,
    CobradoresModule,
  ],
  controllers: [SincronizacionOfflineController],
  providers: [
    DevicesService,
    SincronizacionOfflineService,
    SnapshotDiaService,
    DeviceApiKeyGuard,
    AplicarEventosOfflineService,
    EvidenciasOfflineService,
    AplicarOfflineJob,
  ],
})
export class SincronizacionOfflineModule {}